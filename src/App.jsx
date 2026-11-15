import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_BASE = "https://lego-inventory-backend.onrender.com";

const CACHE_KEYS = {
  sets: 'lego_tracker_cache_sets_v1',
  minifigs: 'lego_tracker_cache_minifigs_v1',
  wishlist: 'lego_tracker_cache_wishlist_v1',
  sales: 'lego_tracker_cache_sales_v1',
  lastUpdated: 'lego_tracker_cache_updated_v1',
  offlineQueue: 'lego_tracker_offline_queue_v1'
};

const readCache = (key, fallback = []) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.warn("Local cache read error:", err);
    return fallback;
  }
};

const writeCache = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    localStorage.setItem(CACHE_KEYS.lastUpdated, new Date().toLocaleString());
  } catch (err) {
    console.warn("Local cache write error:", err);
  }
};

const readQueue = () => readCache(CACHE_KEYS.offlineQueue, []);

const writeQueue = (queue) => {
  try {
    localStorage.setItem(CACHE_KEYS.offlineQueue, JSON.stringify(queue));
  } catch (err) {
    console.warn("Offline queue write error:", err);
  }
};

const formatImageUrl = (url, itemNumber, isMinifig = false) => {
  if (itemNumber && itemNumber !== 'N/A' && itemNumber !== 'Unknown') {
    if (isMinifig) {
      return `https://images.brickset.com/minifigs/large/${itemNumber}.jpg`;
    }
    const cleanNum = itemNumber.split('-')[0].trim();
    return `https://images.brickset.com/sets/images/${cleanNum}-1.jpg`;
  }
  if (url && url.startsWith('//')) return `https:${url}`;
  if (url && url.startsWith('http://')) return url.replace('http://', 'https://');
  return url;
};

const getBrickLinkCatalogUrl = (itemNumber, isMinifig = false) => {
  const clean = String(itemNumber || '').trim();
  if (!clean) return 'https://www.bricklink.com';
  if (isMinifig) {
    return `https://www.bricklink.com/v2/catalog/catalogitem.page?M=${encodeURIComponent(clean)}`;
  }
  const formatted = clean.includes('-') ? clean : `${clean}-1`;
  return `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${encodeURIComponent(formatted)}`;
};

// Extract & pack [Box: Yes] / [Box: No] tag inside item_notes so zero backend schema changes are required
const parseSetBoxInfo = (setItem) => {
  const rawNotes = String(setItem?.item_notes || '');
  const match = rawNotes.match(/\[Box:\s*(Yes|No)\]/i);
  const cleanNotes = rawNotes.replace(/\s*\[Box:\s*(Yes|No)\]\s*/gi, ' ').trim();
  if (match) {
    const val = match[1].toLowerCase() === 'yes' ? 'Yes' : 'No';
    return { hasBox: val, cleanNotes };
  }
  if (setItem?.has_box === 'Yes' || setItem?.has_box === 'No') {
    return { hasBox: setItem.has_box, cleanNotes };
  }
  return { hasBox: '', cleanNotes };
};

const buildNotesWithBox = (cleanNotes, hasBox) => {
  const base = String(cleanNotes || '').replace(/\s*\[Box:\s*(Yes|No)\]\s*/gi, ' ').trim();
  if (hasBox === 'Yes' || hasBox === 'No') {
    return base ? `${base} [Box: ${hasBox}]` : `[Box: ${hasBox}]`;
  }
  return base;
};

// Normalizes server auto-increment IDs (> 0) and offline temp IDs (-Date.now() < 0)
// so newly added items always rank highest when sorted by Date Added descending
const getDateAddedRank = (item) => {
  if (item.created_at) {
    const ts = Date.parse(item.created_at);
    if (!Number.isNaN(ts)) return ts;
  }
  const id = Number(item.id) || 0;
  if (id < 0) {
    return 1e12 + Math.abs(id);
  }
  return id;
};

const exportToCSV = (data, filename = 'lego_inventory.csv') => {
  if (!data || !data.length) {
    alert("No data available to export.");
    return;
  }
  const isSetsExport = filename.startsWith('sets');
  const normalizedData = isSetsExport
    ? data.map(row => {
        const { hasBox, cleanNotes } = parseSetBoxInfo(row);
        return {
          ...row,
          has_box: hasBox || (row.condition === 'New' ? 'Yes' : ''),
          item_notes: cleanNotes
        };
      })
    : data;

  const headers = Object.keys(normalizedData[0]).filter(k => !k.startsWith('_'));
  const csvRows = [
    headers.join(','),
    ...normalizedData.map(row => 
      headers.map(field => {
        const value = row[field] === null || row[field] === undefined ? '' : row[field];
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    )
  ];
  
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', filename);
  a.click();
  window.URL.revokeObjectURL(url);
};

// Robust RFC-4180 CSV parser supporting quoted commas & newlines
const parseCSVText = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmptyRows = rows.filter(r => r.some(cell => cell.trim() !== ''));
  if (nonEmptyRows.length < 2) return [];

  const rawHeaders = nonEmptyRows[0].map(h => h.replace(/^\uFEFF/, '').trim().toLowerCase());
  return nonEmptyRows.slice(1).map(cells => {
    const obj = {};
    rawHeaders.forEach((h, idx) => {
      if (h) obj[h] = (cells[idx] || '').trim();
    });
    return obj;
  });
};

const pickCol = (row, aliases, fallback = '') => {
  for (const key of aliases) {
    if (row[key] !== undefined && row[key] !== '') return row[key];
  }
  return fallback;
};

const parseMoney = (val) => {
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
};

const normalizeCondition = (val) => {
  const v = String(val || '').trim().toLowerCase();
  if (v === 'u' || v === 'used') return 'Used';
  return 'New';
};

const normalizePolybag = (val) => {
  const v = String(val || '').trim().toLowerCase();
  if (v === 'yes' || v === 'true' || v === '1' || v === 'y') return 'Yes';
  return 'No';
};

const normalizeHasBox = (val) => {
  const v = String(val || '').trim().toLowerCase();
  if (v === 'yes' || v === 'true' || v === '1' || v === 'y') return 'Yes';
  if (v === 'no' || v === 'false' || v === '0' || v === 'n') return 'No';
  return '';
};

const mapCsvRowsForTarget = (rawRows, targetType) => {
  const mapped = [];
  let skipped = 0;

  rawRows.forEach(r => {
    if (targetType === 'SETS') {
      const setNum = pickCol(r, ['set_number', 'set num', 'setnumber', 'set_num', 'number', 'item_number', 'item no']);
      if (!setNum) { skipped++; return; }
      const setName = pickCol(r, ['set_name', 'name', 'set name', 'title', 'description'], `Set ${setNum}`);
      const condition = normalizeCondition(pickCol(r, ['condition', 'cond', 'new/used'], 'New'));
      const rawHasBox = normalizeHasBox(pickCol(r, ['has_box', 'box', 'with_box', 'original_box'], ''));
      const rawNotes = pickCol(r, ['item_notes', 'notes', 'remarks', 'comment'], '');
      const packedNotes = buildNotesWithBox(rawNotes, rawHasBox);
      mapped.push({
        set_number: setNum,
        set_name: setName,
        theme: pickCol(r, ['theme', 'category', 'theme_name'], ''),
        quantity: Math.max(1, parseInt(pickCol(r, ['quantity', 'qty', 'owned'], '1'), 10) || 1),
        condition,
        has_box: rawHasBox,
        purchase_price: parseMoney(pickCol(r, ['purchase_price', 'cost', 'my cost', 'price', 'paid'], '0')),
        purchase_dt: pickCol(r, ['purchase_dt', 'purchase_date', 'date', 'purchased'], ''),
        new_shelf: pickCol(r, ['new_shelf', 'shelf', 'shelf_location', 'location', 'bin'], ''),
        store: pickCol(r, ['store', 'source', 'retailer', 'seller'], ''),
        polybag: normalizePolybag(pickCol(r, ['polybag', 'is_polybag'], 'No')),
        item_notes: packedNotes
      });
    } else if (targetType === 'MINIFIGS') {
      const figNum = pickCol(r, ['fig_number', 'fig num', 'fignumber', 'fig_num', 'item_number', 'number', 'item no']);
      if (!figNum) { skipped++; return; }
      const figName = pickCol(r, ['fig_name', 'name', 'fig name', 'title', 'description'], `Minifig ${figNum}`);
      mapped.push({
        fig_number: figNum,
        fig_name: figName,
        theme: pickCol(r, ['theme', 'category', 'theme_name'], ''),
        quantity: Math.max(1, parseInt(pickCol(r, ['quantity', 'qty', 'owned'], '1'), 10) || 1),
        condition: normalizeCondition(pickCol(r, ['condition', 'cond', 'new/used'], 'New')),
        purchase_price: parseMoney(pickCol(r, ['purchase_price', 'cost', 'my cost', 'price', 'paid'], '0')),
        shelf_location: pickCol(r, ['shelf_location', 'new_shelf', 'shelf', 'location', 'bin'], ''),
        status: pickCol(r, ['status'], 'In Collection'),
        notes: pickCol(r, ['notes', 'item_notes', 'remarks', 'comment'], '')
      });
    } else if (targetType === 'WISHLIST') {
      const itemNum = pickCol(r, ['item_number', 'set_number', 'fig_number', 'number', 'item no']);
      if (!itemNum) { skipped++; return; }
      const itemName = pickCol(r, ['item_name', 'set_name', 'fig_name', 'name', 'title'], `Item ${itemNum}`);
      const rawType = pickCol(r, ['item_type', 'type'], '').toUpperCase();
      const inferredType = rawType === 'MINIFIG' || rawType === 'SET'
        ? rawType
        : (/^[a-zA-Z]/.test(itemNum) ? 'MINIFIG' : 'SET');
      mapped.push({
        item_number: itemNum,
        item_name: itemName,
        item_type: inferredType,
        target_price: parseMoney(pickCol(r, ['target_price', 'price', 'max_price', 'budget'], '0')),
        priority: pickCol(r, ['priority'], 'Medium'),
        notes: pickCol(r, ['notes', 'item_notes', 'remarks'], '')
      });
    } else if (targetType === 'SALES') {
      const itemNum = pickCol(r, ['item_number', 'set_number', 'fig_number', 'number']);
      if (!itemNum) { skipped++; return; }
      const itemName = pickCol(r, ['item_name', 'set_name', 'fig_name', 'name'], `Item ${itemNum}`);
      mapped.push({
        item_number: itemNum,
        item_name: itemName,
        item_type: pickCol(r, ['item_type', 'type'], 'SET').toUpperCase(),
        sale_date: pickCol(r, ['sale_date', 'date', 'sold_date'], new Date().toISOString().split('T')[0]),
        sale_price: parseMoney(pickCol(r, ['sale_price', 'sold_price', 'price', 'revenue'], '0')),
        cost_price: parseMoney(pickCol(r, ['cost_price', 'purchase_price', 'cost'], '0')),
        platform_fees: parseMoney(pickCol(r, ['platform_fees', 'fees', 'fee'], '0')),
        shipping_cost: parseMoney(pickCol(r, ['shipping_cost', 'shipping'], '0')),
        platform: pickCol(r, ['platform', 'marketplace', 'channel'], 'eBay'),
        notes: pickCol(r, ['notes', 'remarks'], '')
      });
    }
  });

  return { mapped, skipped };
};

const SAMPLE_CSV_TEMPLATES = {
  SETS: {
    filename: 'sample_sets_import.csv',
    content: 'set_number,set_name,theme,quantity,condition,has_box,purchase_price,purchase_dt,new_shelf,store,polybag,item_notes\n75192,Millennium Falcon,Star Wars,1,New,Yes,649.99,2025-11-15,Shelf A1,LEGO Store,No,UCS Box\n75301,Luke Skywalker X-Wing,Star Wars,1,Used,No,28.00,2026-01-10,Shelf B2,Local Seller,No,Complete with instructions'
  },
  MINIFIGS: {
    filename: 'sample_minifigs_import.csv',
    content: 'fig_number,fig_name,theme,quantity,condition,purchase_price,shelf_location,status,notes\nsw0001a,Battle Droid Tan,Star Wars,3,Used,2.50,Case B2,In Collection,Clean joints\ncol24-11,Orc,Collectible Minifigures,1,New,5.00,Case B3,For Sale,Sealed'
  },
  WISHLIST: {
    filename: 'sample_wishlist_import.csv',
    content: 'item_number,item_name,item_type,target_price,priority,notes\n10316,The Lord of the Rings: Rivendell,SET,425.00,High,Watch for double points\nsw0540,Darth Revan,MINIFIG,220.00,Medium,Sealed polybag preferred'
  },
  SALES: {
    filename: 'sample_sales_import.csv',
    content: 'item_number,item_name,item_type,sale_date,sale_price,cost_price,platform_fees,shipping_cost,platform,notes\n75301,Luke Skywalker X-Wing Fighter,SET,2026-02-14,68.00,39.99,8.84,6.50,eBay,Sold fast'
  }
};

function App() {
  const [activeTab, setActiveTab] = useState('sets');
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastCachedTime, setLastCachedTime] = useState(() => localStorage.getItem(CACHE_KEYS.lastUpdated) || '');
  const [pendingQueue, setPendingQueue] = useState(() => readQueue());
  const isFlushingRef = useRef(false);

  // Initialize state immediately from phone's local cache for zero-wait startup
  const [sets, setSets] = useState(() => readCache(CACHE_KEYS.sets, []));
  const [loadingSets, setLoadingSets] = useState(() => readCache(CACHE_KEYS.sets, []).length === 0);
  const [filterPolybag, setFilterPolybag] = useState('ALL');
  const [filterSetTheme, setFilterSetTheme] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [minifigs, setMinifigs] = useState(() => readCache(CACHE_KEYS.minifigs, []));
  const [loadingMinifigs, setLoadingMinifigs] = useState(false);
  const [minifigSearchQuery, setMinifigSearchQuery] = useState('');
  const [minifigStatusFilter, setMinifigStatusFilter] = useState('ALL');
  const [filterFigTheme, setFilterFigTheme] = useState('ALL');

  const [wishlist, setWishlist] = useState(() => readCache(CACHE_KEYS.wishlist, []));
  const [loadingWishlist, setLoadingWishlist] = useState(false);
  const [wishlistSearchQuery, setWishlistSearchQuery] = useState('');

  const [sales, setSales] = useState(() => readCache(CACHE_KEYS.sales, []));
  const [loadingSales, setLoadingSales] = useState(false);
  const [salesSearchQuery, setSalesSearchQuery] = useState('');

  const [syncStatus, setSyncStatus] = useState('');

  // Default sort: Date Added (newest first)
  const [sortField, setSortField] = useState('date_added');
  const [sortOrder, setSortOrder] = useState('desc');

  // Detail Sheet & Image Zoom State
  const [detailItem, setDetailItem] = useState(null); // { type: 'SET' | 'MINIFIG', data: item }
  const [zoomedImageUrl, setZoomedImageUrl] = useState(null);

  // CSV Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTargetType, setImportTargetType] = useState('SETS');
  const [importDuplicateMode, setImportDuplicateMode] = useState('ADD_QTY'); // 'ADD_QTY' | 'SKIP' | 'SEPARATE'
  const [importFileName, setImportFileName] = useState('');
  const [importParsedRows, setImportParsedRows] = useState([]);
  const [importSkippedCount, setImportSkippedCount] = useState(0);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const csvFileInputRef = useRef(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSet, setEditingSet] = useState(null);
  const [isLookingUpSet, setIsLookingUpSet] = useState(false);
  const [formData, setFormData] = useState({
    set_number: '', set_name: '', theme: '', quantity: 1, condition: 'New', has_box: '',
    purchase_price: 0.0, purchase_dt: '', new_shelf: '', item_notes: '', store: '', polybag: 'No'
  });

  const [isFigModalOpen, setIsFigModalOpen] = useState(false);
  const [editingFig, setEditingFig] = useState(null);
  const [isLookingUpFig, setIsLookingUpFig] = useState(false);
  const [figFormData, setFigFormData] = useState({
    fig_number: '', fig_name: '', theme: '', quantity: 1, condition: 'New',
    purchase_price: 0.0, shelf_location: '', notes: '', status: 'In Collection'
  });

  const [isWishModalOpen, setIsWishModalOpen] = useState(false);
  const [editingWish, setEditingWish] = useState(null);
  const [isLookingUpWish, setIsLookingUpWish] = useState(false);
  const [wishFormData, setWishFormData] = useState({
    item_number: '', item_name: '', item_type: 'SET', target_price: 0.0, priority: 'Medium', notes: ''
  });

  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [saleSourceItem, setSaleSourceItem] = useState(null); // { type: 'SET' | 'MINIFIG', item: obj }
  const [deductFromInventory, setDeductFromInventory] = useState(false);
  const [saleFormData, setSaleFormData] = useState({
    item_number: '', item_name: '', item_type: 'SET', sale_date: '',
    sale_price: 0.0, cost_price: 0.0, platform_fees: 0.0, shipping_cost: 0.0, platform: 'eBay', notes: ''
  });

  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef(null);

  const enqueueOfflineAction = (action) => {
    const updated = [...readQueue(), { ...action, queueId: Date.now() + Math.random(), createdAt: new Date().toISOString() }];
    writeQueue(updated);
    setPendingQueue(updated);
  };

  const fetchSets = async () => {
    if (sets.length === 0) setLoadingSets(true);
    try {
      const res = await fetch(`${API_BASE}/sets`);
      if (res.ok) {
        const data = await res.json();
        setSets(data);
        writeCache(CACHE_KEYS.sets, data);
        setLastCachedTime(localStorage.getItem(CACHE_KEYS.lastUpdated) || '');
      }
    } catch (err) {
      console.warn("Offline or server unreachable (using cached sets):", err);
    } finally {
      setLoadingSets(false);
    }
  };

  const fetchMinifigs = async () => {
    if (minifigs.length === 0) setLoadingMinifigs(true);
    try {
      const res = await fetch(`${API_BASE}/minifigs`);
      if (res.ok) {
        const data = await res.json();
        setMinifigs(data);
        writeCache(CACHE_KEYS.minifigs, data);
        setLastCachedTime(localStorage.getItem(CACHE_KEYS.lastUpdated) || '');
      }
    } catch (err) {
      console.warn("Offline or server unreachable (using cached minifigs):", err);
    } finally {
      setLoadingMinifigs(false);
    }
  };

  const fetchWishlist = async () => {
    if (wishlist.length === 0) setLoadingWishlist(true);
    try {
      const res = await fetch(`${API_BASE}/wishlist`);
      if (res.ok) {
        const data = await res.json();
        setWishlist(data);
        writeCache(CACHE_KEYS.wishlist, data);
        setLastCachedTime(localStorage.getItem(CACHE_KEYS.lastUpdated) || '');
      }
    } catch (err) {
      console.warn("Offline or server unreachable (using cached wishlist):", err);
    } finally {
      setLoadingWishlist(false);
    }
  };

  const fetchSales = async () => {
    if (sales.length === 0) setLoadingSales(true);
    try {
      const res = await fetch(`${API_BASE}/sales`);
      if (res.ok) {
        const data = await res.json();
        setSales(data);
        writeCache(CACHE_KEYS.sales, data);
        setLastCachedTime(localStorage.getItem(CACHE_KEYS.lastUpdated) || '');
      }
    } catch (err) {
      console.warn("Offline or server unreachable (using cached sales):", err);
    } finally {
      setLoadingSales(false);
    }
  };

  const flushOfflineQueue = async (silent = false) => {
    const queue = readQueue();
    if (!queue.length || !navigator.onLine || isFlushingRef.current) return 0;

    isFlushingRef.current = true;
    if (!silent) setSyncStatus(`Uploading ${queue.length} offline change(s) to server...`);

    const remaining = [];
    let uploadedCount = 0;

    for (const item of queue) {
      try {
        const res = await fetch(`${API_BASE}${item.endpoint}`, {
          method: item.method,
          headers: item.body ? { 'Content-Type': 'application/json' } : undefined,
          body: item.body ? JSON.stringify(item.body) : undefined
        });
        if (res.ok || res.status === 404) {
          uploadedCount++;
        } else {
          remaining.push(item);
        }
      } catch (err) {
        remaining.push(item);
      }
    }

    writeQueue(remaining);
    setPendingQueue(remaining);
    isFlushingRef.current = false;

    if (uploadedCount > 0) {
      await Promise.all([fetchSets(), fetchMinifigs(), fetchWishlist(), fetchSales()]);
      if (!silent) {
        setSyncStatus(`✅ Uploaded ${uploadedCount} offline change(s) and updated local cache!`);
      }
    }
    return uploadedCount;
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushOfflineQueue(false);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (navigator.onLine) {
      flushOfflineQueue(true).then((uploaded) => {
        if (!uploaded) {
          fetchSets();
          fetchMinifigs();
          fetchWishlist();
          fetchSales();
        }
      });
    }
  }, []);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      // Default to newest first ('desc') when selecting Date Added or Sale Date
      setSortOrder(field === 'date_added' || field === 'sale_date' ? 'desc' : 'asc');
    }
  };

  const handleSync = async () => {
    if (!navigator.onLine) {
      setSyncStatus('📴 You are offline — changes are queued safely on your phone.');
      return;
    }
    await flushOfflineQueue(false);
    setSyncStatus('Syncing with BrickLink API & updating local phone cache...');
    try {
      const res = await fetch(`${API_BASE}/sync-bricklink`, { method: 'POST' });
      const data = await res.json();
      setSyncStatus(data.message || 'Sync completed & saved offline.');
      await Promise.all([fetchSets(), fetchMinifigs(), fetchWishlist(), fetchSales()]);
    } catch (err) {
      setSyncStatus('Error syncing with BrickLink (offline cache preserved).');
    }
  };

  // --- CSV IMPORT HANDLERS ---
  const handleOpenImportModal = () => {
    const defaultTarget =
      activeTab === 'minifigs' ? 'MINIFIGS' :
      activeTab === 'wishlist' ? 'WISHLIST' :
      activeTab === 'sales' ? 'SALES' : 'SETS';
    setImportTargetType(defaultTarget);
    setImportDuplicateMode('ADD_QTY');
    setImportFileName('');
    setImportParsedRows([]);
    setImportSkippedCount(0);
    setIsImportModalOpen(true);
  };

  const handleCsvFileSelected = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawRows = parseCSVText(ev.target.result || '');
      const { mapped, skipped } = mapCsvRowsForTarget(rawRows, importTargetType);
      setImportParsedRows(mapped);
      setImportSkippedCount(skipped);
    };
    reader.readAsText(file);
  };

  const handleImportTargetChange = (newTarget) => {
    setImportTargetType(newTarget);
    if (csvFileInputRef.current && csvFileInputRef.current.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const rawRows = parseCSVText(ev.target.result || '');
        const { mapped, skipped } = mapCsvRowsForTarget(rawRows, newTarget);
        setImportParsedRows(mapped);
        setImportSkippedCount(skipped);
      };
      reader.readAsText(csvFileInputRef.current.files[0]);
    } else {
      setImportParsedRows([]);
      setImportSkippedCount(0);
    }
  };

  const handleDownloadSampleCsv = () => {
    const tpl = SAMPLE_CSV_TEMPLATES[importTargetType];
    const blob = new Blob([tpl.content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', tpl.filename);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleConfirmCsvImport = async () => {
    if (!importParsedRows.length) return;
    setIsImportingCsv(true);

    let addedCount = 0;
    let updatedCount = 0;
    let skippedDupes = 0;
    const apiOperations = [];

    if (importTargetType === 'SETS') {
      let nextSets = [...sets];
      importParsedRows.forEach((row, idx) => {
        const matchIndex = nextSets.findIndex(
          s => String(s.set_number).trim().toLowerCase() === String(row.set_number).trim().toLowerCase() &&
               (s.condition || 'New').toLowerCase() === (row.condition || 'New').toLowerCase()
        );

        if (matchIndex !== -1 && importDuplicateMode === 'SKIP') {
          skippedDupes++;
          return;
        }

        if (matchIndex !== -1 && importDuplicateMode === 'ADD_QTY') {
          const existing = nextSets[matchIndex];
          const newQty = (existing.quantity || 1) + (row.quantity || 1);
          const merged = {
            ...existing,
            quantity: newQty,
            set_name: row.set_name || existing.set_name,
            theme: row.theme || existing.theme,
            new_shelf: row.new_shelf || existing.new_shelf,
            store: row.store || existing.store,
            item_notes: row.item_notes || existing.item_notes,
            _pendingSync: !navigator.onLine
          };
          nextSets[matchIndex] = merged;
          updatedCount++;
          if (existing.id > 0) {
            apiOperations.push({
              endpoint: `/sets/${existing.id}`,
              method: 'PUT',
              body: {
                set_number: merged.set_number,
                set_name: merged.set_name,
                theme: merged.theme || null,
                quantity: merged.quantity,
                condition: merged.condition || 'New',
                purchase_price: merged.purchase_price || 0.0,
                purchase_dt: merged.purchase_dt || null,
                new_shelf: merged.new_shelf || null,
                item_notes: merged.item_notes || null,
                store: merged.store || null,
                polybag: merged.polybag || 'No'
              },
              label: `CSV Update Set ${merged.set_number}`
            });
          }
        } else {
          const tempItem = {
            ...row,
            id: -(Date.now() + idx + 1),
            market_price_new: 0,
            market_price_used: 0,
            _pendingSync: !navigator.onLine
          };
          nextSets = [tempItem, ...nextSets];
          addedCount++;
          apiOperations.push({
            endpoint: '/add-set',
            method: 'POST',
            body: row,
            label: `CSV Add Set ${row.set_number}`
          });
        }
      });
      setSets(nextSets);
      writeCache(CACHE_KEYS.sets, nextSets);
    } else if (importTargetType === 'MINIFIGS') {
      let nextFigs = [...minifigs];
      importParsedRows.forEach((row, idx) => {
        const matchIndex = nextFigs.findIndex(
          f => String(f.fig_number).trim().toLowerCase() === String(row.fig_number).trim().toLowerCase() &&
               (f.condition || 'New').toLowerCase() === (row.condition || 'New').toLowerCase()
        );

        if (matchIndex !== -1 && importDuplicateMode === 'SKIP') {
          skippedDupes++;
          return;
        }

        if (matchIndex !== -1 && importDuplicateMode === 'ADD_QTY') {
          const existing = nextFigs[matchIndex];
          const newQty = (existing.quantity || 1) + (row.quantity || 1);
          const merged = {
            ...existing,
            quantity: newQty,
            fig_name: row.fig_name || existing.fig_name,
            theme: row.theme || existing.theme,
            shelf_location: row.shelf_location || existing.shelf_location,
            notes: row.notes || existing.notes,
            _pendingSync: !navigator.onLine
          };
          nextFigs[matchIndex] = merged;
          updatedCount++;
          if (existing.id > 0) {
            apiOperations.push({
              endpoint: `/minifigs/${existing.id}`,
              method: 'PUT',
              body: {
                fig_number: merged.fig_number,
                fig_name: merged.fig_name,
                theme: merged.theme || null,
                quantity: merged.quantity,
                condition: merged.condition || 'New',
                purchase_price: merged.purchase_price || 0.0,
                shelf_location: merged.shelf_location || null,
                notes: merged.notes || null,
                status: merged.status || 'In Collection'
              },
              label: `CSV Update Minifig ${merged.fig_number}`
            });
          }
        } else {
          const tempItem = {
            ...row,
            id: -(Date.now() + idx + 1),
            market_price_new: 0,
            market_price_used: 0,
            _pendingSync: !navigator.onLine
          };
          nextFigs = [tempItem, ...nextFigs];
          addedCount++;
          apiOperations.push({
            endpoint: '/add-minifig',
            method: 'POST',
            body: row,
            label: `CSV Add Minifig ${row.fig_number}`
          });
        }
      });
      setMinifigs(nextFigs);
      writeCache(CACHE_KEYS.minifigs, nextFigs);
    } else if (importTargetType === 'WISHLIST') {
      let nextWish = [...wishlist];
      importParsedRows.forEach((row, idx) => {
        const exists = nextWish.some(
          w => String(w.item_number).trim().toLowerCase() === String(row.item_number).trim().toLowerCase()
        );
        if (exists && importDuplicateMode !== 'SEPARATE') {
          skippedDupes++;
          return;
        }
        const tempItem = {
          ...row,
          id: -(Date.now() + idx + 1),
          market_price_new: 0,
          market_price_used: 0,
          _pendingSync: !navigator.onLine
        };
        nextWish = [tempItem, ...nextWish];
        addedCount++;
        apiOperations.push({
          endpoint: '/add-wishlist',
          method: 'POST',
          body: row,
          label: `CSV Add Wishlist ${row.item_number}`
        });
      });
      setWishlist(nextWish);
      writeCache(CACHE_KEYS.wishlist, nextWish);
    } else if (importTargetType === 'SALES') {
      let nextSales = [...sales];
      importParsedRows.forEach((row, idx) => {
        const net_profit = (row.sale_price || 0) - ((row.cost_price || 0) + (row.platform_fees || 0) + (row.shipping_cost || 0));
        const tempItem = {
          ...row,
          id: -(Date.now() + idx + 1),
          net_profit,
          _pendingSync: !navigator.onLine
        };
        nextSales = [tempItem, ...nextSales];
        addedCount++;
        apiOperations.push({
          endpoint: '/add-sale',
          method: 'POST',
          body: row,
          label: `CSV Add Sale ${row.item_number}`
        });
      });
      setSales(nextSales);
      writeCache(CACHE_KEYS.sales, nextSales);
    }

    setLastCachedTime(localStorage.getItem(CACHE_KEYS.lastUpdated) || '');

    if (!navigator.onLine) {
      apiOperations.forEach(op => enqueueOfflineAction(op));
    } else {
      for (const op of apiOperations) {
        try {
          const res = await fetch(`${API_BASE}${op.endpoint}`, {
            method: op.method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(op.body)
          });
          if (!res.ok) enqueueOfflineAction(op);
        } catch (err) {
          enqueueOfflineAction(op);
        }
      }
      if (importTargetType === 'SETS') fetchSets();
      else if (importTargetType === 'MINIFIGS') fetchMinifigs();
      else if (importTargetType === 'WISHLIST') fetchWishlist();
      else if (importTargetType === 'SALES') fetchSales();
    }

    setIsImportingCsv(false);
    setIsImportModalOpen(false);
    setActiveTab(importTargetType.toLowerCase());

    const parts = [];
    if (addedCount > 0) parts.push(`${addedCount} added`);
    if (updatedCount > 0) parts.push(`${updatedCount} qty updated`);
    if (skippedDupes > 0) parts.push(`${skippedDupes} skipped`);
    setSyncStatus(`📤 CSV Import complete: ${parts.join(', ') || '0 changes'}${!navigator.onLine ? ' (queued offline)' : ''}.`);
  };

  const decodeHtml = (str) => {
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
  };

  const handleLookupSet = async () => {
    const cleanNum = formData.set_number.trim();
    if (!cleanNum || !navigator.onLine) return;
    setIsLookingUpSet(true);
    try {
      const res = await fetch(`${API_BASE}/lookup/SET/${encodeURIComponent(cleanNum)}`);
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({
          ...prev,
          set_name: data.name ? decodeHtml(data.name) : prev.set_name,
          theme: data.theme ? decodeHtml(data.theme) : prev.theme
        }));
      }
    } catch (err) {
      console.error("BrickLink set lookup error:", err);
    } finally {
      setIsLookingUpSet(false);
    }
  };

  const handleLookupFig = async () => {
    const cleanNum = figFormData.fig_number.trim();
    if (!cleanNum || !navigator.onLine) return;
    setIsLookingUpFig(true);
    try {
      const res = await fetch(`${API_BASE}/lookup/MINIFIG/${encodeURIComponent(cleanNum)}`);
      if (res.ok) {
        const data = await res.json();
        setFigFormData(prev => ({
          ...prev,
          fig_name: data.name ? decodeHtml(data.name) : prev.fig_name,
          theme: data.theme ? decodeHtml(data.theme) : prev.theme
        }));
      }
    } catch (err) {
      console.error("BrickLink minifig lookup error:", err);
    } finally {
      setIsLookingUpFig(false);
    }
  };

  const handleLookupWish = async () => {
    const cleanNum = wishFormData.item_number.trim();
    if (!cleanNum || !navigator.onLine) return;
    setIsLookingUpWish(true);
    try {
      const res = await fetch(`${API_BASE}/lookup/${wishFormData.item_type}/${encodeURIComponent(cleanNum)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.name) {
          setWishFormData(prev => ({ ...prev, item_name: decodeHtml(data.name) }));
        }
      }
    } catch (err) {
      console.error("BrickLink wishlist lookup error:", err);
    } finally {
      setIsLookingUpWish(false);
    }
  };

  // --- QUICK CONDITION & BOX UPDATES DIRECTLY FROM SLIDE-UP DETAIL SHEET ---
  const handleQuickUpdateSetFields = async (setItem, updates, statusLabel) => {
    const { hasBox: currentBox, cleanNotes } = parseSetBoxInfo(setItem);
    const nextCondition = updates.condition !== undefined ? updates.condition : (setItem.condition || 'New');
    const nextHasBox = updates.has_box !== undefined ? updates.has_box : currentBox;
    const nextNotes = buildNotesWithBox(cleanNotes, nextHasBox);

    const updatedItem = {
      ...setItem,
      condition: nextCondition,
      has_box: nextHasBox,
      item_notes: nextNotes,
      _pendingSync: !navigator.onLine
    };

    const updatedSets = sets.map(s => s.id === setItem.id ? updatedItem : s);
    setSets(updatedSets);
    writeCache(CACHE_KEYS.sets, updatedSets);
    setLastCachedTime(localStorage.getItem(CACHE_KEYS.lastUpdated) || '');
    setDetailItem({ type: 'SET', data: updatedItem });

    const payload = {
      set_number: updatedItem.set_number,
      set_name: updatedItem.set_name,
      theme: updatedItem.theme || null,
      quantity: updatedItem.quantity || 1,
      condition: nextCondition,
      purchase_price: updatedItem.purchase_price || 0.0,
      purchase_dt: updatedItem.purchase_dt || null,
      new_shelf: updatedItem.new_shelf || null,
      item_notes: nextNotes || null,
      store: updatedItem.store || null,
      polybag: updatedItem.polybag || 'No'
    };

    if (setItem.id < 0) return;

    if (!navigator.onLine) {
      enqueueOfflineAction({
        endpoint: `/sets/${setItem.id}`,
        method: 'PUT',
        body: payload,
        label: `${statusLabel} for Set ${setItem.set_number}`
      });
      setSyncStatus(`📴 Saved ${statusLabel} offline (will sync when online).`);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/sets/${setItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        fetchSets();
      } else {
        throw new Error("Server error");
      }
    } catch (err) {
      enqueueOfflineAction({
        endpoint: `/sets/${setItem.id}`,
        method: 'PUT',
        body: payload,
        label: `${statusLabel} for Set ${setItem.set_number}`
      });
      setSyncStatus(`📴 Server unreachable — queued ${statusLabel} offline.`);
    }
  };

  const handleQuickUpdateFigCondition = async (figItem, nextCondition) => {
    if ((figItem.condition || 'New') === nextCondition) return;
    const updatedItem = {
      ...figItem,
      condition: nextCondition,
      _pendingSync: !navigator.onLine
    };

    const updatedFigs = minifigs.map(f => f.id === figItem.id ? updatedItem : f);
    setMinifigs(updatedFigs);
    writeCache(CACHE_KEYS.minifigs, updatedFigs);
    setLastCachedTime(localStorage.getItem(CACHE_KEYS.lastUpdated) || '');
    setDetailItem({ type: 'MINIFIG', data: updatedItem });

    const payload = {
      fig_number: updatedItem.fig_number,
      fig_name: updatedItem.fig_name,
      theme: updatedItem.theme || null,
      quantity: updatedItem.quantity || 1,
      condition: nextCondition,
      purchase_price: updatedItem.purchase_price || 0.0,
      shelf_location: updatedItem.shelf_location || null,
      notes: updatedItem.notes || null,
      status: updatedItem.status || 'In Collection'
    };

    if (figItem.id < 0) return;

    if (!navigator.onLine) {
      enqueueOfflineAction({
        endpoint: `/minifigs/${figItem.id}`,
        method: 'PUT',
        body: payload,
        label: `Condition: ${nextCondition} for Minifig ${figItem.fig_number}`
      });
      setSyncStatus(`📴 Saved Condition: ${nextCondition} offline.`);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/minifigs/${figItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        fetchMinifigs();
      } else {
        throw new Error("Server error");
      }
    } catch (err) {
      enqueueOfflineAction({
        endpoint: `/minifigs/${figItem.id}`,
        method: 'PUT',
        body: payload,
        label: `Condition: ${nextCondition} for Minifig ${figItem.fig_number}`
      });
      setSyncStatus(`📴 Server unreachable — queued Condition update offline.`);
    }
  };

  // --- SETS CRUD (WITH OFFLINE QUEUE FALLBACK) ---
  const handleOpenModal = (setItem = null) => {
    if (setItem) {
      const { hasBox, cleanNotes } = parseSetBoxInfo(setItem);
      setEditingSet(setItem);
      setFormData({
        set_number: setItem.set_number || '', set_name: setItem.set_name || '', theme: setItem.theme || '',
        quantity: setItem.quantity || 1, condition: setItem.condition || 'New', has_box: hasBox,
        purchase_price: setItem.purchase_price || 0.0,
        purchase_dt: setItem.purchase_dt || '', new_shelf: setItem.new_shelf || '',
        item_notes: cleanNotes, store: setItem.store || '', polybag: setItem.polybag || 'No'
      });
    } else {
      setEditingSet(null);
      setFormData({
        set_number: '', set_name: '', theme: '', quantity: 1, condition: 'New', has_box: '',
        purchase_price: 0.0,
        purchase_dt: '', new_shelf: '', item_notes: '', store: '', polybag: 'No'
      });
    }
    setIsModalOpen(true);
  };

  const buildSetPayload = () => {
    const packedNotes = buildNotesWithBox(formData.item_notes, formData.has_box);
    return {
      ...formData,
      item_notes: packedNotes
    };
  };

  const applySetLocally = (payload) => {
    let updated;
    if (editingSet) {
      updated = sets.map(s => s.id === editingSet.id ? { ...s, ...payload, _pendingSync: true } : s);
    } else {
      const tempItem = {
        ...payload,
        id: -Date.now(),
        market_price_new: 0,
        market_price_used: 0,
        _pendingSync: true
      };
      updated = [tempItem, ...sets];
    }
    setSets(updated);
    writeCache(CACHE_KEYS.sets, updated);
    setLastCachedTime(localStorage.getItem(CACHE_KEYS.lastUpdated) || '');
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const isTempOfflineItem = editingSet && editingSet.id < 0;
    const endpoint = (editingSet && !isTempOfflineItem) ? `/sets/${editingSet.id}` : `/add-set`;
    const method = (editingSet && !isTempOfflineItem) ? 'PUT' : 'POST';
    const payload = buildSetPayload();

    if (!navigator.onLine) {
      applySetLocally(payload);
      enqueueOfflineAction({ endpoint, method, body: payload, label: `Set ${payload.set_number}` });
      setIsModalOpen(false);
      setSyncStatus(`📴 Saved Set ${payload.set_number} offline (will sync when back online).`);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchSets();
      } else {
        throw new Error("Server returned error");
      }
    } catch (err) {
      applySetLocally(payload);
      enqueueOfflineAction({ endpoint, method, body: payload, label: `Set ${payload.set_number}` });
      setIsModalOpen(false);
      setSyncStatus(`📴 Server unreachable — saved Set ${payload.set_number} to offline queue.`);
    }
  };

  const handleDeleteSet = async (id) => {
    if (!window.confirm("Delete this set?")) return;
    const updated = sets.filter(s => s.id !== id);
    setSets(updated);
    writeCache(CACHE_KEYS.sets, updated);
    if (detailItem?.data?.id === id) setDetailItem(null);

    if (id < 0) return;

    if (!navigator.onLine) {
      enqueueOfflineAction({ endpoint: `/sets/${id}`, method: 'DELETE', label: `Delete set #${id}` });
      setSyncStatus('📴 Set deleted offline (will sync when back online).');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/sets/${id}`, { method: 'DELETE' });
      if (res.ok) fetchSets();
    } catch (err) {
      enqueueOfflineAction({ endpoint: `/sets/${id}`, method: 'DELETE', label: `Delete set #${id}` });
      setSyncStatus('📴 Server unreachable — delete queued for sync.');
    }
  };

  const handleQuickSellSet = (setItem) => {
    const isUsed = setItem.condition && setItem.condition.toLowerCase() === 'used';
    const activePrice = isUsed ? (setItem.market_price_used || 0) : (setItem.market_price_new || 0);
    setEditingSale(null);
    setSaleSourceItem({ type: 'SET', item: setItem });
    setDeductFromInventory(true);
    setSaleFormData({
      item_number: setItem.set_number || '',
      item_name: setItem.set_name || '',
      item_type: 'SET',
      sale_date: new Date().toISOString().split('T')[0],
      sale_price: activePrice,
      cost_price: setItem.purchase_price || 0.0,
      platform_fees: 0.0,
      shipping_cost: 0.0,
      platform: 'eBay',
      notes: setItem.new_shelf ? `Sold from shelf: ${setItem.new_shelf}` : ''
    });
    setIsSaleModalOpen(true);
  };

  // --- MINIFIGS CRUD (WITH OFFLINE QUEUE FALLBACK) ---
  const handleOpenFigModal = (figItem = null) => {
    if (figItem) {
      setEditingFig(figItem);
      setFigFormData({
        fig_number: figItem.fig_number || '', fig_name: figItem.fig_name || '', theme: figItem.theme || '',
        quantity: figItem.quantity || 1, condition: figItem.condition || 'New', purchase_price: figItem.purchase_price || 0.0,
        shelf_location: figItem.shelf_location || '', notes: figItem.notes || '', status: figItem.status || 'In Collection'
      });
    } else {
      setEditingFig(null);
      setFigFormData({
        fig_number: '', fig_name: '', theme: '', quantity: 1, condition: 'New', purchase_price: 0.0, shelf_location: '', notes: '', status: 'In Collection'
      });
    }
    setIsFigModalOpen(true);
  };

  const applyFigLocally = () => {
    let updated;
    if (editingFig) {
      updated = minifigs.map(f => f.id === editingFig.id ? { ...f, ...figFormData, _pendingSync: true } : f);
    } else {
      const tempItem = {
        ...figFormData,
        id: -Date.now(),
        market_price_new: 0,
        market_price_used: 0,
        _pendingSync: true
      };
      updated = [tempItem, ...minifigs];
    }
    setMinifigs(updated);
    writeCache(CACHE_KEYS.minifigs, updated);
    setLastCachedTime(localStorage.getItem(CACHE_KEYS.lastUpdated) || '');
  };

  const handleFigFormSubmit = async (e) => {
    e.preventDefault();
    const isTempOfflineItem = editingFig && editingFig.id < 0;
    const endpoint = (editingFig && !isTempOfflineItem) ? `/minifigs/${editingFig.id}` : `/add-minifig`;
    const method = (editingFig && !isTempOfflineItem) ? 'PUT' : 'POST';

    if (!navigator.onLine) {
      applyFigLocally();
      enqueueOfflineAction({ endpoint, method, body: figFormData, label: `Minifig ${figFormData.fig_number}` });
      setIsFigModalOpen(false);
      setSyncStatus(`📴 Saved Minifig ${figFormData.fig_number} offline (will sync when back online).`);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(figFormData)
      });
      if (res.ok) {
        setIsFigModalOpen(false);
        fetchMinifigs();
      } else {
        throw new Error("Server returned error");
      }
    } catch (err) {
      applyFigLocally();
      enqueueOfflineAction({ endpoint, method, body: figFormData, label: `Minifig ${figFormData.fig_number}` });
      setIsFigModalOpen(false);
      setSyncStatus(`📴 Server unreachable — saved Minifig ${figFormData.fig_number} to offline queue.`);
    }
  };

  const handleDeleteFig = async (id) => {
    if (!window.confirm("Delete this minifigure?")) return;
    const updated = minifigs.filter(f => f.id !== id);
    setMinifigs(updated);
    writeCache(CACHE_KEYS.minifigs, updated);
    if (detailItem?.data?.id === id) setDetailItem(null);

    if (id < 0) return;

    if (!navigator.onLine) {
      enqueueOfflineAction({ endpoint: `/minifigs/${id}`, method: 'DELETE', label: `Delete minifig #${id}` });
      setSyncStatus('📴 Minifigure deleted offline (will sync when back online).');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/minifigs/${id}`, { method: 'DELETE' });
      if (res.ok) fetchMinifigs();
    } catch (err) {
      enqueueOfflineAction({ endpoint: `/minifigs/${id}`, method: 'DELETE', label: `Delete minifig #${id}` });
      setSyncStatus('📴 Server unreachable — delete queued for sync.');
    }
  };

  const handleQuickSellFig = (figItem) => {
    setEditingSale(null);
    setSaleSourceItem({ type: 'MINIFIG', item: figItem });
    setDeductFromInventory(true);
    setSaleFormData({
      item_number: figItem.fig_number || '',
      item_name: figItem.fig_name || '',
      item_type: 'MINIFIG',
      sale_date: new Date().toISOString().split('T')[0],
      sale_price: figItem.market_price_used || figItem.market_price_new || 0.0,
      cost_price: figItem.purchase_price || 0.0,
      platform_fees: 0.0,
      shipping_cost: 0.0,
      platform: 'eBay',
      notes: `Sold from minifig status: ${figItem.status || 'For Sale'}`
    });
    setIsSaleModalOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzePhoto = async () => {
    if (!previewImage) return;
    if (!navigator.onLine) {
      alert("AI photo recognition requires an internet connection. You can still add the minifigure manually while offline!");
      return;
    }
    setIsAnalyzing(true);
    try {
      const res = await fetch(`${API_BASE}/identify-minifig`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: previewImage })
      });
      const data = await res.json();
      setIsAnalyzing(false);
      setIsScanModalOpen(false);
      setPreviewImage(null);

      setEditingFig(null);
      setFigFormData({
        fig_number: data.fig_number || '',
        fig_name: data.fig_name || '',
        theme: data.theme || '',
        quantity: 1,
        condition: 'New',
        purchase_price: 0.0,
        shelf_location: '',
        notes: data.fig_number
          ? `Identified via Brickognize (${data.confidence} confidence)`
          : 'No confident match found — please enter manually',
        status: 'In Collection'
      });
      setIsFigModalOpen(true);
    } catch (err) {
      console.error(err);
      setIsAnalyzing(false);
      alert("Error recognizing minifigure. Opening manual add form.");
      setIsScanModalOpen(false);
      handleOpenFigModal();
    }
  };

  // --- WISHLIST CRUD (WITH OFFLINE QUEUE FALLBACK) ---
  const handleOpenWishModal = (wishItem = null) => {
    if (wishItem) {
      setEditingWish(wishItem);
      setWishFormData({
        item_number: wishItem.item_number || '', item_name: wishItem.item_name || '', item_type: wishItem.item_type || 'SET',
        target_price: wishItem.target_price || 0.0, priority: wishItem.priority || 'Medium', notes: wishItem.notes || ''
      });
    } else {
      setEditingWish(null);
      setWishFormData({
        item_number: '', item_name: '', item_type: 'SET', target_price: 0.0, priority: 'Medium', notes: ''
      });
    }
    setIsWishModalOpen(true);
  };

  const applyWishLocally = () => {
    let updated;
    if (editingWish) {
      updated = wishlist.map(w => w.id === editingWish.id ? { ...w, ...wishFormData, _pendingSync: true } : w);
    } else {
      const tempItem = {
        ...wishFormData,
        id: -Date.now(),
        market_price_new: 0,
        market_price_used: 0,
        _pendingSync: true
      };
      updated = [tempItem, ...wishlist];
    }
    setWishlist(updated);
    writeCache(CACHE_KEYS.wishlist, updated);
    setLastCachedTime(localStorage.getItem(CACHE_KEYS.lastUpdated) || '');
  };

  const handleWishFormSubmit = async (e) => {
    e.preventDefault();
    const isTempOfflineItem = editingWish && editingWish.id < 0;
    const endpoint = (editingWish && !isTempOfflineItem) ? `/wishlist/${editingWish.id}` : `/add-wishlist`;
    const method = (editingWish && !isTempOfflineItem) ? 'PUT' : 'POST';

    if (!navigator.onLine) {
      applyWishLocally();
      enqueueOfflineAction({ endpoint, method, body: wishFormData, label: `Wishlist ${wishFormData.item_number}` });
      setIsWishModalOpen(false);
      setSyncStatus(`📴 Saved Wishlist ${wishFormData.item_number} offline (will sync when back online).`);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wishFormData)
      });
      if (res.ok) {
        setIsWishModalOpen(false);
        fetchWishlist();
      } else {
        throw new Error("Server returned error");
      }
    } catch (err) {
      applyWishLocally();
      enqueueOfflineAction({ endpoint, method, body: wishFormData, label: `Wishlist ${wishFormData.item_number}` });
      setIsWishModalOpen(false);
      setSyncStatus(`📴 Server unreachable — saved Wishlist ${wishFormData.item_number} to offline queue.`);
    }
  };

  const handleDeleteWish = async (id) => {
    if (!window.confirm("Delete this wishlist item?")) return;
    const updated = wishlist.filter(w => w.id !== id);
    setWishlist(updated);
    writeCache(CACHE_KEYS.wishlist, updated);

    if (id < 0) return;

    if (!navigator.onLine) {
      enqueueOfflineAction({ endpoint: `/wishlist/${id}`, method: 'DELETE', label: `Delete wishlist #${id}` });
      setSyncStatus('📴 Wishlist item deleted offline (will sync when back online).');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/wishlist/${id}`, { method: 'DELETE' });
      if (res.ok) fetchWishlist();
    } catch (err) {
      enqueueOfflineAction({ endpoint: `/wishlist/${id}`, method: 'DELETE', label: `Delete wishlist #${id}` });
      setSyncStatus('📴 Server unreachable — delete queued for sync.');
    }
  };

  // --- SALES CRUD (WITH AUTO-INVENTORY DEDUCTION & OFFLINE QUEUE FALLBACK) ---
  const handleOpenSaleModal = (saleItem = null) => {
    setSaleSourceItem(null);
    setDeductFromInventory(false);
    if (saleItem) {
      setEditingSale(saleItem);
      setSaleFormData({
        item_number: saleItem.item_number || '', item_name: saleItem.item_name || '', item_type: saleItem.item_type || 'SET',
        sale_date: saleItem.sale_date || '', sale_price: saleItem.sale_price || 0.0, cost_price: saleItem.cost_price || 0.0,
        platform_fees: saleItem.platform_fees || 0.0, shipping_cost: saleItem.shipping_cost || 0.0,
        platform: saleItem.platform || 'eBay', notes: saleItem.notes || ''
      });
    } else {
      setEditingSale(null);
      setSaleFormData({
        item_number: '', item_name: '', item_type: 'SET', sale_date: new Date().toISOString().split('T')[0],
        sale_price: 0.0, cost_price: 0.0, platform_fees: 0.0, shipping_cost: 0.0, platform: 'eBay', notes: ''
      });
    }
    setIsSaleModalOpen(true);
  };

  const applyInventoryDeduction = async () => {
    if (!deductFromInventory || !saleSourceItem) return '';
    const { type, item } = saleSourceItem;
    const currentQty = item.quantity || 1;
    const isSet = type === 'SET';
    const basePath = isSet ? '/sets' : '/minifigs';

    if (currentQty > 1) {
      const newQty = currentQty - 1;
      const updatePayload = isSet
        ? {
            set_number: item.set_number,
            set_name: item.set_name,
            theme: item.theme || null,
            quantity: newQty,
            condition: item.condition || 'New',
            purchase_price: item.purchase_price || 0.0,
            purchase_dt: item.purchase_dt || null,
            new_shelf: item.new_shelf || null,
            item_notes: item.item_notes || null,
            store: item.store || null,
            polybag: item.polybag || 'No'
          }
        : {
            fig_number: item.fig_number,
            fig_name: item.fig_name,
            theme: item.theme || null,
            quantity: newQty,
            condition: item.condition || 'New',
            purchase_price: item.purchase_price || 0.0,
            shelf_location: item.shelf_location || null,
            notes: item.notes || null,
            status: item.status || 'In Collection'
          };

      if (isSet) {
        const updatedSets = sets.map(s => s.id === item.id ? { ...s, quantity: newQty } : s);
        setSets(updatedSets);
        writeCache(CACHE_KEYS.sets, updatedSets);
      } else {
        const updatedFigs = minifigs.map(f => f.id === item.id ? { ...f, quantity: newQty } : f);
        setMinifigs(updatedFigs);
        writeCache(CACHE_KEYS.minifigs, updatedFigs);
      }

      if (item.id > 0) {
        if (!navigator.onLine) {
          enqueueOfflineAction({ endpoint: `${basePath}/${item.id}`, method: 'PUT', body: updatePayload, label: `Decrement ${type} #${item.id}` });
        } else {
          try {
            const res = await fetch(`${API_BASE}${basePath}/${item.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updatePayload)
            });
            if (res.ok) {
              if (isSet) fetchSets();
              else fetchMinifigs();
            } else {
              throw new Error("Server error");
            }
          } catch (err) {
            enqueueOfflineAction({ endpoint: `${basePath}/${item.id}`, method: 'PUT', body: updatePayload, label: `Decrement ${type} #${item.id}` });
          }
        }
      }
      return ` (Qty reduced ${currentQty} → ${newQty})`;
    } else {
      if (isSet) {
        const updatedSets = sets.filter(s => s.id !== item.id);
        setSets(updatedSets);
        writeCache(CACHE_KEYS.sets, updatedSets);
      } else {
        const updatedFigs = minifigs.filter(f => f.id !== item.id);
        setMinifigs(updatedFigs);
        writeCache(CACHE_KEYS.minifigs, updatedFigs);
      }

      if (item.id > 0) {
        if (!navigator.onLine) {
          enqueueOfflineAction({ endpoint: `${basePath}/${item.id}`, method: 'DELETE', label: `Remove sold ${type} #${item.id}` });
        } else {
          try {
            const res = await fetch(`${API_BASE}${basePath}/${item.id}`, { method: 'DELETE' });
            if (res.ok) {
              if (isSet) fetchSets();
              else fetchMinifigs();
            } else {
              throw new Error("Server error");
            }
          } catch (err) {
            enqueueOfflineAction({ endpoint: `${basePath}/${item.id}`, method: 'DELETE', label: `Remove sold ${type} #${item.id}` });
          }
        }
      }
      return ' (Removed from active inventory)';
    }
  };

  const applySaleLocally = () => {
    const net_profit = (saleFormData.sale_price || 0) - ((saleFormData.cost_price || 0) + (saleFormData.platform_fees || 0) + (saleFormData.shipping_cost || 0));
    let updated;
    if (editingSale) {
      updated = sales.map(s => s.id === editingSale.id ? { ...s, ...saleFormData, net_profit, _pendingSync: true } : s);
    } else {
      const tempItem = {
        ...saleFormData,
        id: -Date.now(),
        net_profit,
        _pendingSync: true
      };
      updated = [tempItem, ...sales];
    }
    setSales(updated);
    writeCache(CACHE_KEYS.sales, updated);
    setLastCachedTime(localStorage.getItem(CACHE_KEYS.lastUpdated) || '');
  };

  const handleSaleFormSubmit = async (e) => {
    e.preventDefault();
    const isTempOfflineItem = editingSale && editingSale.id < 0;
    const endpoint = (editingSale && !isTempOfflineItem) ? `/sales/${editingSale.id}` : `/add-sale`;
    const method = (editingSale && !isTempOfflineItem) ? 'PUT' : 'POST';

    const deductNote = await applyInventoryDeduction();
    setSaleSourceItem(null);
    setDeductFromInventory(false);

    if (!navigator.onLine) {
      applySaleLocally();
      enqueueOfflineAction({ endpoint, method, body: saleFormData, label: `Sale ${saleFormData.item_number}` });
      setIsSaleModalOpen(false);
      setSyncStatus(`📴 Logged sale for ${saleFormData.item_number} offline${deductNote}.`);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleFormData)
      });
      if (res.ok) {
        setIsSaleModalOpen(false);
        fetchSales();
        if (deductNote) {
          setSyncStatus(`✅ Logged sale for ${saleFormData.item_number}${deductNote}`);
        }
      } else {
        throw new Error("Server returned error");
      }
    } catch (err) {
      applySaleLocally();
      enqueueOfflineAction({ endpoint, method, body: saleFormData, label: `Sale ${saleFormData.item_number}` });
      setIsSaleModalOpen(false);
      setSyncStatus(`📴 Server unreachable — saved Sale ${saleFormData.item_number} to offline queue${deductNote}.`);
    }
  };

  const handleDeleteSale = async (id) => {
    if (!window.confirm("Delete this sale entry?")) return;
    const updated = sales.filter(s => s.id !== id);
    setSales(updated);
    writeCache(CACHE_KEYS.sales, updated);

    if (id < 0) return;

    if (!navigator.onLine) {
      enqueueOfflineAction({ endpoint: `/sales/${id}`, method: 'DELETE', label: `Delete sale #${id}` });
      setSyncStatus('📴 Sale deleted offline (will sync when back online).');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/sales/${id}`, { method: 'DELETE' });
      if (res.ok) fetchSales();
    } catch (err) {
      enqueueOfflineAction({ endpoint: `/sales/${id}`, method: 'DELETE', label: `Delete sale #${id}` });
      setSyncStatus('📴 Server unreachable — delete queued for sync.');
    }
  };

  const sortData = (data, getValFunc) => {
    return [...data].sort((a, b) => {
      if (sortField === 'date_added') {
        const aRank = getDateAddedRank(a);
        const bRank = getDateAddedRank(b);
        return sortOrder === 'asc' ? aRank - bRank : bRank - aRank;
      }

      let aVal = getValFunc(a, sortField);
      let bVal = getValFunc(b, sortField);

      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      aVal = aVal.toString().toLowerCase();
      bVal = bVal.toString().toLowerCase();

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const availableSetThemes = Array.from(new Set(sets.map(s => s.theme).filter(Boolean))).sort();
  const availableFigThemes = Array.from(new Set(minifigs.map(f => f.theme).filter(Boolean))).sort();

  const filteredSets = sets.filter(s => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = s.set_name?.toLowerCase().includes(q) || 
                          s.set_number?.toLowerCase().includes(q) ||
                          s.theme?.toLowerCase().includes(q) ||
                          s.store?.toLowerCase().includes(q) ||
                          s.item_notes?.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (filterSetTheme !== 'ALL' && (s.theme || '') !== filterSetTheme) return false;
    if (filterPolybag === 'YES') return (s.polybag?.toLowerCase() === 'yes' || s.polybag?.toLowerCase() === 'true');
    if (filterPolybag === 'NO') return (!s.polybag || s.polybag?.toLowerCase() === 'no' || s.polybag?.toLowerCase() === 'false');
    return true;
  });

  const sortedSets = sortData(filteredSets, (item, field) => {
    if (field === 'market_price') {
      const isUsed = item.condition && item.condition.toLowerCase() === 'used';
      return isUsed ? (item.market_price_used || 0) : (item.market_price_new || 0);
    }
    if (field === 'has_box') {
      const { hasBox } = parseSetBoxInfo(item);
      return hasBox || (item.condition === 'New' ? 'Yes' : '');
    }
    return item[field];
  });

  const totalSets = filteredSets.reduce((acc, s) => acc + (s.quantity || 1), 0);
  const totalCost = filteredSets.reduce((acc, s) => acc + ((s.purchase_price || 0) * (s.quantity || 1)), 0);
  const totalMarketVal = filteredSets.reduce((acc, s) => {
    const isUsed = s.condition && s.condition.toLowerCase() === 'used';
    const price = isUsed ? (s.market_price_used || 0) : (s.market_price_new || 0);
    return acc + (price * (s.quantity || 1));
  }, 0);

  const filteredMinifigs = minifigs.filter(f => {
    const q = minifigSearchQuery.toLowerCase();
    const matchesSearch = f.fig_name?.toLowerCase().includes(q) || 
                          f.fig_number?.toLowerCase().includes(q) || 
                          f.theme?.toLowerCase().includes(q) || 
                          f.notes?.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (filterFigTheme !== 'ALL' && (f.theme || '') !== filterFigTheme) return false;
    if (minifigStatusFilter !== 'ALL' && (f.status || 'In Collection') !== minifigStatusFilter) return false;
    return true;
  });

  const sortedMinifigs = sortData(filteredMinifigs, (item, field) => {
    if (field === 'market_price') {
      const isUsed = item.condition && item.condition.toLowerCase() === 'used';
      return isUsed ? (item.market_price_used || 0) : (item.market_price_new || 0);
    }
    return item[field];
  });

  const totalFigQty = filteredMinifigs.reduce((acc, f) => acc + (f.quantity || 1), 0);
  const totalFigCost = filteredMinifigs.reduce((acc, f) => acc + ((f.purchase_price || 0) * (f.quantity || 1)), 0);
  const totalFigMarketVal = filteredMinifigs.reduce((acc, f) => {
    const isUsed = f.condition && f.condition.toLowerCase() === 'used';
    const price = isUsed ? (f.market_price_used || 0) : (f.market_price_new || 0);
    return acc + (price * (f.quantity || 1));
  }, 0);

  const filteredWishlist = wishlist.filter(w => {
    const q = wishlistSearchQuery.toLowerCase();
    return w.item_name?.toLowerCase().includes(q) || w.item_number?.toLowerCase().includes(q) || w.notes?.toLowerCase().includes(q);
  });

  const sortedWishlist = sortData(filteredWishlist, (item, field) => item[field]);
  const totalWishTarget = filteredWishlist.reduce((acc, w) => acc + (w.target_price || 0), 0);

  const filteredSales = sales.filter(s => {
    const q = salesSearchQuery.toLowerCase();
    return s.item_name?.toLowerCase().includes(q) || s.item_number?.toLowerCase().includes(q) || s.platform?.toLowerCase().includes(q) || s.notes?.toLowerCase().includes(q);
  });

  const sortedSales = sortData(filteredSales, (item, field) => item[field]);
  const totalRevenue = filteredSales.reduce((acc, s) => acc + (s.sale_price || 0), 0);
  const totalNetProfit = filteredSales.reduce((acc, s) => acc + (s.net_profit || 0), 0);
  const totalSalesCost = filteredSales.reduce((acc, s) => acc + (s.cost_price || 0), 0);
  const overallROI = totalSalesCost > 0 ? ((totalNetProfit / totalSalesCost) * 100).toFixed(1) : '0.0';

  // --- DASHBOARD AGGREGATIONS (ALL COLLECTION DATA) ---
  const allSetsQty = sets.reduce((acc, s) => acc + (s.quantity || 1), 0);
  const allSetsCost = sets.reduce((acc, s) => acc + ((s.purchase_price || 0) * (s.quantity || 1)), 0);
  const allSetsMarket = sets.reduce((acc, s) => {
    const isUsed = s.condition && s.condition.toLowerCase() === 'used';
    const price = isUsed ? (s.market_price_used || 0) : (s.market_price_new || 0);
    return acc + (price * (s.quantity || 1));
  }, 0);

  const allFigsQty = minifigs.reduce((acc, f) => acc + (f.quantity || 1), 0);
  const allFigsCost = minifigs.reduce((acc, f) => acc + ((f.purchase_price || 0) * (f.quantity || 1)), 0);
  const allFigsMarket = minifigs.reduce((acc, f) => {
    const isUsed = f.condition && f.condition.toLowerCase() === 'used';
    const price = isUsed ? (f.market_price_used || 0) : (f.market_price_new || 0);
    return acc + (price * (f.quantity || 1));
  }, 0);

  const portfolioCost = allSetsCost + allFigsCost;
  const portfolioMarket = allSetsMarket + allFigsMarket;
  const unrealizedGain = portfolioMarket - portfolioCost;
  const portfolioROI = portfolioCost > 0 ? ((unrealizedGain / portfolioCost) * 100).toFixed(1) : '0.0';
  const allSalesProfit = sales.reduce((acc, s) => acc + (s.net_profit || 0), 0);

  const themeBreakdownMap = {};
  sets.forEach(s => {
    const t = s.theme && s.theme.trim() ? s.theme.trim() : 'Uncategorized';
    const qty = s.quantity || 1;
    const isUsed = s.condition && s.condition.toLowerCase() === 'used';
    const price = isUsed ? (s.market_price_used || 0) : (s.market_price_new || 0);
    if (!themeBreakdownMap[t]) themeBreakdownMap[t] = { theme: t, setsQty: 0, figsQty: 0, cost: 0, market: 0 };
    themeBreakdownMap[t].setsQty += qty;
    themeBreakdownMap[t].cost += (s.purchase_price || 0) * qty;
    themeBreakdownMap[t].market += price * qty;
  });
  minifigs.forEach(f => {
    const t = f.theme && f.theme.trim() ? f.theme.trim() : 'Uncategorized';
    const qty = f.quantity || 1;
    const isUsed = f.condition && f.condition.toLowerCase() === 'used';
    const price = isUsed ? (f.market_price_used || 0) : (f.market_price_new || 0);
    if (!themeBreakdownMap[t]) themeBreakdownMap[t] = { theme: t, setsQty: 0, figsQty: 0, cost: 0, market: 0 };
    themeBreakdownMap[t].figsQty += qty;
    themeBreakdownMap[t].cost += (f.purchase_price || 0) * qty;
    themeBreakdownMap[t].market += price * qty;
  });
  const themeBreakdown = Object.values(themeBreakdownMap).sort((a, b) => b.market - a.market || (b.setsQty + b.figsQty) - (a.setsQty + a.figsQty));

  const shelfBreakdownMap = {};
  sets.forEach(s => {
    const sh = s.new_shelf && s.new_shelf.trim() ? s.new_shelf.trim() : 'Unassigned';
    const qty = s.quantity || 1;
    const isUsed = s.condition && s.condition.toLowerCase() === 'used';
    const price = isUsed ? (s.market_price_used || 0) : (s.market_price_new || 0);
    if (!shelfBreakdownMap[sh]) shelfBreakdownMap[sh] = { shelf: sh, count: 0, market: 0 };
    shelfBreakdownMap[sh].count += qty;
    shelfBreakdownMap[sh].market += price * qty;
  });
  minifigs.forEach(f => {
    const sh = f.shelf_location && f.shelf_location.trim() ? f.shelf_location.trim() : 'Unassigned';
    const qty = f.quantity || 1;
    const isUsed = f.condition && f.condition.toLowerCase() === 'used';
    const price = isUsed ? (f.market_price_used || 0) : (f.market_price_new || 0);
    if (!shelfBreakdownMap[sh]) shelfBreakdownMap[sh] = { shelf: sh, count: 0, market: 0 };
    shelfBreakdownMap[sh].count += qty;
    shelfBreakdownMap[sh].market += price * qty;
  });
  const shelfBreakdown = Object.values(shelfBreakdownMap).sort((a, b) => b.market - a.market || b.count - a.count);

  const renderSortArrow = (field) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  const renderSortControl = (options) => (
    <div className="filter-group">
      <label>Sort:</label>
      <select
        value={sortField}
        onChange={(e) => {
          const val = e.target.value;
          setSortField(val);
          setSortOrder(val === 'date_added' || val === 'sale_date' ? 'desc' : 'asc');
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <button
        type="button"
        className="btn-icon"
        title="Toggle Sort Direction"
        onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
      >
        {sortOrder === 'asc' ? '↑' : '↓'}
      </button>
      <button
        type="button"
        className={`btn btn-sm ${sortField === 'date_added' ? 'btn-primary' : 'btn-secondary'}`}
        title="Sort by Date Added (Newest First)"
        onClick={() => {
          if (sortField === 'date_added') {
            setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
          } else {
            setSortField('date_added');
            setSortOrder('desc');
          }
        }}
      >
        🕒 Date Added{sortField === 'date_added' ? (sortOrder === 'desc' ? ' ↓' : ' ↑') : ''}
      </button>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div>
          <h1>🧱 LEGO Tracker</h1>
          <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: '2px' }}>
            {isOnline ? '🟢 Online' : '📴 Offline'}
            {pendingQueue.length > 0 ? ` · 🟡 ${pendingQueue.length} pending` : ''}
            {lastCachedTime ? ` · Saved: ${lastCachedTime}` : ''}
          </div>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-secondary"
            title="Import items from CSV"
            onClick={handleOpenImportModal}
          >
            📤 Import
          </button>
          <button 
            className="btn btn-secondary" 
            title="Export active tab to CSV"
            onClick={() => exportToCSV(
              activeTab === 'minifigs' ? minifigs : 
              activeTab === 'wishlist' ? wishlist : 
              activeTab === 'sales' ? sales : sets, 
              `${activeTab}_export.csv`
            )}
          >
            📥 CSV
          </button>
          <button className="btn btn-primary" onClick={handleSync}>
            {pendingQueue.length > 0 ? `Sync (${pendingQueue.length})` : 'Sync'}
          </button>
        </div>
      </header>

      <nav className="tab-bar">
        <button className={`tab-btn ${activeTab === 'sets' ? 'active' : ''}`} onClick={() => { setActiveTab('sets'); setSortField('date_added'); setSortOrder('desc'); }}>
          📦 Sets ({sets.length})
        </button>
        <button className={`tab-btn ${activeTab === 'minifigs' ? 'active' : ''}`} onClick={() => { setActiveTab('minifigs'); setSortField('date_added'); setSortOrder('desc'); }}>
          🦸 Minifigs ({minifigs.length})
        </button>
        <button className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          📊 Stats
        </button>
        <button className={`tab-btn ${activeTab === 'wishlist' ? 'active' : ''}`} onClick={() => { setActiveTab('wishlist'); setSortField('date_added'); setSortOrder('desc'); }}>
          ⭐ Wishlist ({wishlist.length})
        </button>
        <button className={`tab-btn ${activeTab === 'sales' ? 'active' : ''}`} onClick={() => { setActiveTab('sales'); setSortField('sale_date'); setSortOrder('desc'); }}>
          💰 Sales ({sales.length})
        </button>
      </nav>

      {!isOnline && (
        <div className="sync-banner" style={{ backgroundColor: '#b45309' }}>
          📴 Offline Mode — Edits save locally and upload automatically when reconnected
        </div>
      )}

      {syncStatus && <div className="sync-banner">{syncStatus}</div>}

      {/* TAB 1: SETS INVENTORY */}
      {activeTab === 'sets' && (
        <>
          <section className="stats-row">
            <div className="stat-card"><h3>Total Items</h3><p>{totalSets}</p></div>
            <div className="stat-card"><h3>Total Investment</h3><p>${totalCost.toFixed(2)}</p></div>
            <div className="stat-card"><h3>Market Value</h3><p>${totalMarketVal.toFixed(2)}</p></div>
          </section>

          <section className="controls-row">
            <input type="text" placeholder="Search name, set #, theme, store..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
            <div className="filter-group">
              <label>Theme:</label>
              <select value={filterSetTheme} onChange={(e) => setFilterSetTheme(e.target.value)}>
                <option value="ALL">All Themes</option>
                {availableSetThemes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Polybag:</label>
              <select value={filterPolybag} onChange={(e) => setFilterPolybag(e.target.value)}>
                <option value="ALL">All</option><option value="YES">Polybags Only</option><option value="NO">Sets Only</option>
              </select>
            </div>
            {renderSortControl([
              { value: 'date_added', label: 'Date Added' },
              { value: 'set_number', label: 'Set #' },
              { value: 'set_name', label: 'Name' },
              { value: 'theme', label: 'Theme' },
              { value: 'market_price', label: 'Market Value' },
              { value: 'purchase_price', label: 'Cost' },
              { value: 'new_shelf', label: 'Shelf' },
              { value: 'purchase_dt', label: 'Purchased' },
              { value: 'quantity', label: 'Qty' }
            ])}
            <button className="btn btn-success" onClick={() => handleOpenModal()}>+ Add Set</button>
          </section>

          {loadingSets ? <div className="loading-spinner">Loading inventory...</div> : (
            <div className="table-responsive">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th onClick={() => handleSort('set_number')} style={{ cursor: 'pointer' }}>Set #{renderSortArrow('set_number')}</th>
                    <th onClick={() => handleSort('set_name')} style={{ cursor: 'pointer' }}>Name{renderSortArrow('set_name')}</th>
                    <th onClick={() => handleSort('quantity')} style={{ cursor: 'pointer' }}>Qty{renderSortArrow('quantity')}</th>
                    <th onClick={() => handleSort('condition')} style={{ cursor: 'pointer' }}>Cond.{renderSortArrow('condition')}</th>
                    <th onClick={() => handleSort('has_box')} style={{ cursor: 'pointer' }}>Box{renderSortArrow('has_box')}</th>
                    <th onClick={() => handleSort('purchase_price')} style={{ cursor: 'pointer' }}>Cost{renderSortArrow('purchase_price')}</th>
                    <th onClick={() => handleSort('market_price')} style={{ cursor: 'pointer' }}>Market Value{renderSortArrow('market_price')}</th>
                    <th onClick={() => handleSort('new_shelf')} style={{ cursor: 'pointer' }}>Shelf{renderSortArrow('new_shelf')}</th>
                    <th onClick={() => handleSort('theme')} style={{ cursor: 'pointer' }}>Theme{renderSortArrow('theme')}</th>
                    <th onClick={() => handleSort('purchase_dt')} style={{ cursor: 'pointer' }}>Purchased{renderSortArrow('purchase_dt')}</th>
                    <th onClick={() => handleSort('store')} style={{ cursor: 'pointer' }}>Store{renderSortArrow('store')}</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSets.map((item) => {
                    const imageUrl = formatImageUrl(item.image_url, item.set_number);
                    const isUsed = item.condition && item.condition.toLowerCase() === 'used';
                    const activeMarketPrice = isUsed ? (item.market_price_used || 0) : (item.market_price_new || 0);
                    const { hasBox, cleanNotes } = parseSetBoxInfo(item);
                    const boxDisplay = hasBox || (item.condition === 'New' ? 'Yes' : '-');
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setDetailItem({ type: 'SET', data: item })}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="img-cell">{imageUrl ? <img src={imageUrl} alt={item.set_name} className="set-thumbnail" onError={(e) => { e.target.onerror = null; e.target.src = 'https://cdn-icons-png.flaticon.com/512/808/808440.png'; }} /> : <div className="no-img">No Img</div>}</td>
                        <td><strong>{item.set_number}</strong>{item.theme ? ` · ${item.theme}` : ''}{item._pendingSync ? ' 🟡' : ''}</td>
                        <td>{item.set_name}</td>
                        <td>{item.quantity}</td>
                        <td>{item.condition || 'N/A'}</td>
                        <td>{boxDisplay}</td>
                        <td>${(item.purchase_price || 0).toFixed(2)}</td>
                        <td>${activeMarketPrice.toFixed(2)}</td>
                        <td>{item.new_shelf || '-'}</td>
                        <td>{item.theme || '-'}</td>
                        <td>{item.purchase_dt || '-'}</td>
                        <td>{item.store || '-'}</td>
                        <td>{cleanNotes || '-'}</td>
                        <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                          <button className="btn-icon" title="Quick Log Sale" onClick={() => handleQuickSellSet(item)}>💰</button>
                          <button className="btn-icon" title="Edit" onClick={() => handleOpenModal(item)}>✏️</button>
                          <button className="btn-icon text-danger" title="Delete" onClick={() => handleDeleteSet(item.id)}>🗑️</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* TAB 2: MINIFIGURES */}
      {activeTab === 'minifigs' && (
        <>
          <section className="stats-row">
            <div className="stat-card"><h3>Total Minifigs</h3><p>{totalFigQty}</p></div>
            <div className="stat-card"><h3>Total Cost</h3><p>${totalFigCost.toFixed(2)}</p></div>
            <div className="stat-card"><h3>Market Value</h3><p>${totalFigMarketVal.toFixed(2)}</p></div>
          </section>

          <section className="controls-row">
            <input type="text" placeholder="Search minifigs or themes..." value={minifigSearchQuery} onChange={(e) => setMinifigSearchQuery(e.target.value)} className="search-input" />
            <div className="filter-group">
              <label>Theme:</label>
              <select value={filterFigTheme} onChange={(e) => setFilterFigTheme(e.target.value)}>
                <option value="ALL">All Themes</option>
                {availableFigThemes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Status:</label>
              <select value={minifigStatusFilter} onChange={(e) => setMinifigStatusFilter(e.target.value)}>
                <option value="ALL">All Statuses</option>
                <option value="In Collection">In Collection</option>
                <option value="For Sale">For Sale</option>
                <option value="Draft / Unsorted">Draft / Unsorted</option>
              </select>
            </div>
            {renderSortControl([
              { value: 'date_added', label: 'Date Added' },
              { value: 'fig_number', label: 'Fig #' },
              { value: 'fig_name', label: 'Name' },
              { value: 'theme', label: 'Theme' },
              { value: 'market_price', label: 'Market Value' },
              { value: 'purchase_price', label: 'Cost' },
              { value: 'status', label: 'Status' },
              { value: 'shelf_location', label: 'Shelf' },
              { value: 'quantity', label: 'Qty' }
            ])}
            <div className="button-group">
              <button className="btn btn-primary" onClick={() => setIsScanModalOpen(true)}>📷 Snap & Identify</button>
              <button className="btn btn-success" onClick={() => handleOpenFigModal()}>+ Add Minifig</button>
            </div>
          </section>

          {loadingMinifigs ? <div className="loading-spinner">Loading minifigures...</div> : (
            <div className="table-responsive">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th onClick={() => handleSort('fig_number')} style={{ cursor: 'pointer' }}>Fig #{renderSortArrow('fig_number')}</th>
                    <th onClick={() => handleSort('fig_name')} style={{ cursor: 'pointer' }}>Name{renderSortArrow('fig_name')}</th>
                    <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>Status{renderSortArrow('status')}</th>
                    <th onClick={() => handleSort('quantity')} style={{ cursor: 'pointer' }}>Qty{renderSortArrow('quantity')}</th>
                    <th onClick={() => handleSort('condition')} style={{ cursor: 'pointer' }}>Cond.{renderSortArrow('condition')}</th>
                    <th onClick={() => handleSort('purchase_price')} style={{ cursor: 'pointer' }}>Cost{renderSortArrow('purchase_price')}</th>
                    <th onClick={() => handleSort('market_price')} style={{ cursor: 'pointer' }}>Market Value{renderSortArrow('market_price')}</th>
                    <th onClick={() => handleSort('shelf_location')} style={{ cursor: 'pointer' }}>Shelf{renderSortArrow('shelf_location')}</th>
                    <th onClick={() => handleSort('theme')} style={{ cursor: 'pointer' }}>Theme{renderSortArrow('theme')}</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMinifigs.map((item) => {
                    const imageUrl = formatImageUrl(item.image_url, item.fig_number, true);
                    const isUsed = item.condition && item.condition.toLowerCase() === 'used';
                    const activeMarketPrice = isUsed ? (item.market_price_used || 0) : (item.market_price_new || 0);
                    const status = item.status || 'In Collection';
                    const isForSale = status === 'For Sale';
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setDetailItem({ type: 'MINIFIG', data: item })}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="img-cell">{imageUrl ? <img src={imageUrl} alt={item.fig_name} className="set-thumbnail" onError={(e) => { e.target.onerror = null; e.target.src = 'https://cdn-icons-png.flaticon.com/512/808/808440.png'; }} /> : <div className="no-img">No Img</div>}</td>
                        <td><strong>{item.fig_number}</strong>{item.theme ? ` · ${item.theme}` : ''}{item._pendingSync ? ' 🟡' : ''}</td>
                        <td>{item.fig_name}</td>
                        <td>
                          <span className={`status-badge ${isForSale ? 'badge-sale' : status === 'Draft / Unsorted' ? 'badge-draft' : 'badge-collection'}`}>
                            {status}
                          </span>
                        </td>
                        <td>{item.quantity}</td>
                        <td>{item.condition || 'N/A'}</td>
                        <td>${(item.purchase_price || 0).toFixed(2)}</td>
                        <td>${activeMarketPrice.toFixed(2)}</td>
                        <td>{item.shelf_location || '-'}</td>
                        <td>{item.theme || '-'}</td>
                        <td>{item.notes || '-'}</td>
                        <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                          {isForSale && (
                            <button className="btn-icon" title="Quick Log Sale" onClick={() => handleQuickSellFig(item)}>💰</button>
                          )}
                          <button className="btn-icon" title="Edit" onClick={() => handleOpenFigModal(item)}>✏️</button>
                          <button className="btn-icon text-danger" title="Delete" onClick={() => handleDeleteFig(item.id)}>🗑️</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* TAB 3: DASHBOARD / COLLECTION BREAKDOWN */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: '#f8fafc' }}>
          <section className="stats-row">
            <div className="stat-card" style={{ color: '#f8fafc' }}>
              <h3>Total Portfolio Value</h3>
              <p>${portfolioMarket.toFixed(2)}</p>
              <small style={{ color: '#cbd5e1' }}>{allSetsQty} sets · {allFigsQty} minifigs</small>
            </div>
            <div className="stat-card" style={{ color: '#f8fafc' }}>
              <h3>Total Invested</h3>
              <p>${portfolioCost.toFixed(2)}</p>
              <small style={{ color: '#cbd5e1' }}>Sets: ${allSetsCost.toFixed(0)} · Figs: ${allFigsCost.toFixed(0)}</small>
            </div>
            <div className="stat-card" style={{ color: '#f8fafc' }}>
              <h3>Unrealized Gain</h3>
              <p className={unrealizedGain >= 0 ? 'text-success' : 'text-danger'}>
                {unrealizedGain >= 0 ? '+' : ''}${unrealizedGain.toFixed(2)} ({portfolioROI}%)
              </p>
              <small style={{ color: '#cbd5e1' }}>Realized Sales Profit: ${allSalesProfit.toFixed(2)}</small>
            </div>
          </section>

          <div className="stat-card" style={{ textAlign: 'left', color: '#f8fafc' }}>
            <h3 style={{ marginBottom: '12px', color: '#f8fafc' }}>🏷️ Breakdown by Theme (Tap to Filter Sets)</h3>
            {themeBreakdown.length === 0 ? (
              <p style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>No items in collection yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {themeBreakdown.map((row) => {
                  const sharePct = portfolioMarket > 0 ? Math.min(100, (row.market / portfolioMarket) * 100) : 0;
                  const gain = row.market - row.cost;
                  return (
                    <div
                      key={row.theme}
                      onClick={() => {
                        if (row.setsQty > 0) {
                          setFilterSetTheme(row.theme === 'Uncategorized' ? 'ALL' : row.theme);
                          setActiveTab('sets');
                        } else if (row.figsQty > 0) {
                          setFilterFigTheme(row.theme === 'Uncategorized' ? 'ALL' : row.theme);
                          setActiveTab('minifigs');
                        }
                      }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#f8fafc',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <strong style={{ color: '#ffffff' }}>{row.theme}</strong>
                        <strong style={{ color: '#60a5fa' }}>${row.market.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '6px' }}>
                        <span>{row.setsQty} sets · {row.figsQty} minifigs</span>
                        <span>
                          Cost: ${row.cost.toFixed(2)} ({gain >= 0 ? '+' : ''}${gain.toFixed(0)})
                        </span>
                      </div>
                      <div style={{ height: '6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
                        <div style={{ width: `${sharePct}%`, height: '100%', backgroundColor: '#3b82f6' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="stat-card" style={{ textAlign: 'left', color: '#f8fafc' }}>
            <h3 style={{ marginBottom: '12px', color: '#f8fafc' }}>🗄️ Breakdown by Shelf / Storage Location</h3>
            {shelfBreakdown.length === 0 ? (
              <p style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>No shelf locations recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {shelfBreakdown.map((row) => (
                  <div
                    key={row.shelf}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#f8fafc'
                    }}
                  >
                    <div>
                      <strong style={{ color: '#ffffff' }}>{row.shelf}</strong>
                      <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>{row.count} items</div>
                    </div>
                    <strong style={{ color: '#60a5fa' }}>${row.market.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: WISHLIST */}
      {activeTab === 'wishlist' && (
        <>
          <section className="stats-row">
            <div className="stat-card"><h3>Wishlist Items</h3><p>{filteredWishlist.length}</p></div>
            <div className="stat-card"><h3>Total Target Cost</h3><p>${totalWishTarget.toFixed(2)}</p></div>
          </section>

          <section className="controls-row">
            <input type="text" placeholder="Search wishlist items..." value={wishlistSearchQuery} onChange={(e) => setWishlistSearchQuery(e.target.value)} className="search-input" />
            {renderSortControl([
              { value: 'date_added', label: 'Date Added' },
              { value: 'item_number', label: 'Item #' },
              { value: 'item_name', label: 'Name' },
              { value: 'priority', label: 'Priority' },
              { value: 'target_price', label: 'Target Price' },
              { value: 'market_price_new', label: 'Market Price' }
            ])}
            <button className="btn btn-success" onClick={() => handleOpenWishModal()}>+ Add to Wishlist</button>
          </section>

          {loadingWishlist ? <div className="loading-spinner">Loading wishlist...</div> : (
            <div className="table-responsive">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th onClick={() => handleSort('item_number')} style={{ cursor: 'pointer' }}>Item #{renderSortArrow('item_number')}</th>
                    <th onClick={() => handleSort('item_name')} style={{ cursor: 'pointer' }}>Name{renderSortArrow('item_name')}</th>
                    <th onClick={() => handleSort('item_type')} style={{ cursor: 'pointer' }}>Type{renderSortArrow('item_type')}</th>
                    <th onClick={() => handleSort('priority')} style={{ cursor: 'pointer' }}>Priority{renderSortArrow('priority')}</th>
                    <th onClick={() => handleSort('target_price')} style={{ cursor: 'pointer' }}>Target Price{renderSortArrow('target_price')}</th>
                    <th onClick={() => handleSort('market_price_new')} style={{ cursor: 'pointer' }}>Market (New){renderSortArrow('market_price_new')}</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedWishlist.map((item) => {
                    const imageUrl = formatImageUrl(item.image_url, item.item_number, item.item_type === 'MINIFIG');
                    return (
                      <tr key={item.id}>
                        <td className="img-cell">{imageUrl ? <img src={imageUrl} alt={item.item_name} className="set-thumbnail" onError={(e) => { e.target.onerror = null; e.target.src = 'https://cdn-icons-png.flaticon.com/512/808/808440.png'; }} /> : <div className="no-img">No Img</div>}</td>
                        <td><strong>{item.item_number}</strong>{item._pendingSync ? ' 🟡' : ''}</td>
                        <td>{item.item_name}</td>
                        <td>{item.item_type}</td>
                        <td>{item.priority}</td>
                        <td>${(item.target_price || 0).toFixed(2)}</td>
                        <td>${(item.market_price_new || 0).toFixed(2)}</td>
                        <td>{item.notes || '-'}</td>
                        <td className="actions-cell">
                          <button className="btn-icon" onClick={() => handleOpenWishModal(item)}>✏️</button>
                          <button className="btn-icon text-danger" onClick={() => handleDeleteWish(item.id)}>🗑️</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* TAB 5: SALES LOG */}
      {activeTab === 'sales' && (
        <>
          <section className="stats-row">
            <div className="stat-card"><h3>Total Revenue</h3><p>${totalRevenue.toFixed(2)}</p></div>
            <div className="stat-card"><h3>Net Profit</h3><p>${totalNetProfit.toFixed(2)}</p></div>
            <div className="stat-card"><h3>Overall ROI</h3><p>{overallROI}%</p></div>
          </section>

          <section className="controls-row">
            <input type="text" placeholder="Search sales log..." value={salesSearchQuery} onChange={(e) => setSalesSearchQuery(e.target.value)} className="search-input" />
            {renderSortControl([
              { value: 'sale_date', label: 'Sale Date' },
              { value: 'date_added', label: 'Date Added' },
              { value: 'item_name', label: 'Name' },
              { value: 'sale_price', label: 'Sale Price' },
              { value: 'net_profit', label: 'Net Profit' },
              { value: 'platform', label: 'Platform' }
            ])}
            <button className="btn btn-success" onClick={() => handleOpenSaleModal()}>+ Log Sale</button>
          </section>

          {loadingSales ? <div className="loading-spinner">Loading sales log...</div> : (
            <div className="table-responsive">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Item #</th>
                    <th onClick={() => handleSort('item_name')} style={{ cursor: 'pointer' }}>Name{renderSortArrow('item_name')}</th>
                    <th onClick={() => handleSort('sale_date')} style={{ cursor: 'pointer' }}>Date{renderSortArrow('sale_date')}</th>
                    <th onClick={() => handleSort('sale_price')} style={{ cursor: 'pointer' }}>Sale Price{renderSortArrow('sale_price')}</th>
                    <th onClick={() => handleSort('cost_price')} style={{ cursor: 'pointer' }}>Cost{renderSortArrow('cost_price')}</th>
                    <th onClick={() => handleSort('net_profit')} style={{ cursor: 'pointer' }}>Net Profit{renderSortArrow('net_profit')}</th>
                    <th onClick={() => handleSort('platform')} style={{ cursor: 'pointer' }}>Platform{renderSortArrow('platform')}</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSales.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.item_number}</strong>{item._pendingSync ? ' 🟡' : ''}</td>
                      <td>{item.item_name}</td>
                      <td>{item.sale_date}</td>
                      <td>${(item.sale_price || 0).toFixed(2)}</td>
                      <td>${(item.cost_price || 0).toFixed(2)}</td>
                      <td className={item.net_profit >= 0 ? 'text-success' : 'text-danger'}>
                        ${(item.net_profit || 0).toFixed(2)}
                      </td>
                      <td>{item.platform}</td>
                      <td>{item.notes || '-'}</td>
                      <td className="actions-cell">
                        <button className="btn-icon" onClick={() => handleOpenSaleModal(item)}>✏️</button>
                        <button className="btn-icon text-danger" onClick={() => handleDeleteSale(item.id)}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* --- CSV IMPORT MODAL --- */}
      {isImportModalOpen && (
        <div className="modal-overlay" onClick={() => !isImportingCsv && setIsImportModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <h2>📤 Import from CSV</h2>
            <p style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: '4px', marginBottom: '12px' }}>
              Upload a CSV exported from Google Sheets, Excel, or this app&apos;s <strong>📥 CSV</strong> button.
            </p>

            <div className="form-row">
              <div className="form-group">
                <label>Import Into Tab</label>
                <select
                  value={importTargetType}
                  disabled={isImportingCsv}
                  onChange={(e) => handleImportTargetChange(e.target.value)}
                >
                  <option value="SETS">📦 Sets Inventory</option>
                  <option value="MINIFIGS">🦸 Minifigures</option>
                  <option value="WISHLIST">⭐ Wishlist</option>
                  <option value="SALES">💰 Sales Log</option>
                </select>
              </div>
              <div className="form-group">
                <label>If Item Already Exists</label>
                <select
                  value={importDuplicateMode}
                  disabled={isImportingCsv}
                  onChange={(e) => setImportDuplicateMode(e.target.value)}
                >
                  <option value="ADD_QTY">Add to Quantity</option>
                  <option value="SKIP">Skip Duplicate</option>
                  <option value="SEPARATE">Create Separate Row</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <input
                type="file"
                accept=".csv,text/csv"
                ref={csvFileInputRef}
                onChange={handleCsvFileSelected}
                style={{ display: 'none' }}
              />
              <div
                className="upload-box"
                onClick={() => !isImportingCsv && csvFileInputRef.current && csvFileInputRef.current.click()}
                style={{ padding: '16px', cursor: 'pointer' }}
              >
                <p style={{ margin: 0, fontWeight: 600 }}>
                  {importFileName ? `📄 ${importFileName}` : 'Tap here to choose a .CSV file'}
                </p>
                <small style={{ opacity: 0.8 }}>
                  Accepts set_number / fig_number / item_number, name, theme, quantity, condition, has_box, purchase_price, shelf, store, notes
                </small>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleDownloadSampleCsv}
              >
                ⬇️ Download Sample CSV Template
              </button>
              {importFileName && (
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  ✅ {importParsedRows.length} valid row(s)
                  {importSkippedCount > 0 ? ` · ⚠️ ${importSkippedCount} skipped` : ''}
                </span>
              )}
            </div>

            {importParsedRows.length > 0 && (
              <div
                style={{
                  maxHeight: '160px',
                  overflowY: 'auto',
                  border: '1px solid rgba(148,163,184,0.3)',
                  borderRadius: '8px',
                  padding: '8px',
                  marginBottom: '14px',
                  fontSize: '0.8rem'
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '6px', opacity: 0.85 }}>
                  Preview (first {Math.min(5, importParsedRows.length)} of {importParsedRows.length}):
                </div>
                {importParsedRows.slice(0, 5).map((r, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '4px 0',
                      borderBottom: i < Math.min(4, importParsedRows.length - 1) ? '1px solid rgba(148,163,184,0.2)' : 'none'
                    }}
                  >
                    <strong>{r.set_number || r.fig_number || r.item_number}</strong> —{' '}
                    {r.set_name || r.fig_name || r.item_name}
                    {r.quantity ? ` (Qty: ${r.quantity}, ${r.condition || 'New'}${r.has_box ? `, Box: ${r.has_box}` : ''})` : ''}
                    {r.purchase_price ? ` · $${r.purchase_price.toFixed(2)}` : ''}
                    {r.sale_price ? ` · Sold: $${r.sale_price.toFixed(2)}` : ''}
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isImportingCsv}
                onClick={() => setIsImportModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-success"
                disabled={!importParsedRows.length || isImportingCsv}
                onClick={handleConfirmCsvImport}
              >
                {isImportingCsv ? 'Importing...' : `Import ${importParsedRows.length || ''} Item(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SLIDE-UP CLZ DETAIL SHEET MODAL --- */}
      {detailItem && (() => {
        const isSet = detailItem.type === 'SET';
        const item = detailItem.data;
        const itemNum = isSet ? item.set_number : item.fig_number;
        const itemName = isSet ? item.set_name : item.fig_name;
        const shelf = isSet ? item.new_shelf : item.shelf_location;
        const parsedBox = isSet ? parseSetBoxInfo(item) : { hasBox: '', cleanNotes: item.notes };
        const notes = parsedBox.cleanNotes;
        const hasBox = parsedBox.hasBox;
        const imageUrl = formatImageUrl(item.image_url, itemNum, !isSet);
        const blUrl = getBrickLinkCatalogUrl(itemNum, !isSet);
        const qty = item.quantity || 1;
        const unitCost = item.purchase_price || 0;
        const currentCondition = item.condition || 'New';
        const isUsed = currentCondition.toLowerCase() === 'used';
        const unitMarket = isUsed ? (item.market_price_used || 0) : (item.market_price_new || 0);
        const totalPosCost = unitCost * qty;
        const totalPosMarket = unitMarket * qty;
        const gain = totalPosMarket - totalPosCost;
        const roiPct = totalPosCost > 0 ? ((gain / totalPosCost) * 100).toFixed(1) : null;

        return (
          <div
            className="modal-overlay"
            onClick={() => setDetailItem(null)}
            style={{ alignItems: 'flex-end', padding: 0 }}
          >
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '560px',
                margin: '0 auto',
                borderRadius: '18px 18px 0 0',
                maxHeight: '88vh',
                overflowY: 'auto',
                padding: '18px 20px 26px',
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                borderTop: '1px solid rgba(255,255,255,0.18)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.05em', color: '#94a3b8' }}>
                  {isSet ? '📦 SET DETAILS' : '🦸 MINIFIGURE DETAILS'}
                </span>
                <button
                  type="button"
                  onClick={() => setDetailItem(null)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#f8fafc',
                    borderRadius: '50%',
                    width: '30px',
                    height: '30px',
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
                <div
                  onClick={() => imageUrl && setZoomedImageUrl(imageUrl)}
                  style={{
                    width: '112px',
                    height: '112px',
                    borderRadius: '12px',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                    cursor: imageUrl ? 'zoom-in' : 'default',
                    position: 'relative',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }}
                >
                  {imageUrl ? (
                    <>
                      <img
                        src={imageUrl}
                        alt={itemName}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '6px' }}
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://cdn-icons-png.flaticon.com/512/808/808440.png'; }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '4px',
                          right: '4px',
                          background: 'rgba(15,23,42,0.8)',
                          color: '#fff',
                          fontSize: '0.68rem',
                          padding: '2px 5px',
                          borderRadius: '4px'
                        }}
                      >
                        🔍
                      </span>
                    </>
                  ) : (
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>No Image</span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#60a5fa', marginBottom: '2px' }}>
                    #{itemNum}{item.theme ? ` · ${item.theme}` : ''}
                  </div>
                  <h2 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', lineHeight: 1.3, color: '#ffffff' }}>
                    {itemName}
                  </h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.1)', color: '#e2e8f0' }}>
                      Qty: {qty}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '3px 8px',
                        borderRadius: '999px',
                        backgroundColor: isUsed ? 'rgba(245,158,11,0.22)' : 'rgba(59,130,246,0.25)',
                        color: isUsed ? '#fcd34d' : '#93c5fd'
                      }}
                    >
                      {currentCondition}
                    </span>
                    {isSet && hasBox && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '3px 8px',
                          borderRadius: '999px',
                          backgroundColor: hasBox === 'Yes' ? 'rgba(34,197,94,0.22)' : 'rgba(245,158,11,0.22)',
                          color: hasBox === 'Yes' ? '#86efac' : '#fcd34d'
                        }}
                      >
                        {hasBox === 'Yes' ? '📦 With Box' : '🚫 No Box'}
                      </span>
                    )}
                    {!isSet && (
                      <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '999px', backgroundColor: 'rgba(59,130,246,0.25)', color: '#93c5fd' }}>
                        {item.status || 'In Collection'}
                      </span>
                    )}
                    {isSet && item.polybag?.toLowerCase() === 'yes' && (
                      <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '999px', backgroundColor: 'rgba(168,85,247,0.25)', color: '#d8b4fe' }}>
                        Polybag
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* --- ONE-TAP CONDITION TOGGLE (NEW / USED) --- */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  marginBottom: isSet ? '10px' : '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Condition</div>
                  <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 600 }}>
                    {isUsed ? 'Used (Opened / Built)' : 'New (Sealed)'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isUsed) return;
                      if (isSet) {
                        handleQuickUpdateSetFields(item, { condition: 'New' }, 'Condition: New');
                      } else {
                        handleQuickUpdateFigCondition(item, 'New');
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: !isUsed ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.2)',
                      backgroundColor: !isUsed ? 'rgba(59,130,246,0.28)' : 'rgba(15,23,42,0.5)',
                      color: !isUsed ? '#93c5fd' : '#e2e8f0',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    ✨ New
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isUsed) return;
                      if (isSet) {
                        handleQuickUpdateSetFields(
                          item,
                          { condition: 'Used', has_box: hasBox || 'Yes' },
                          'Condition: Used'
                        );
                      } else {
                        handleQuickUpdateFigCondition(item, 'Used');
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: isUsed ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.2)',
                      backgroundColor: isUsed ? 'rgba(245,158,11,0.28)' : 'rgba(15,23,42,0.5)',
                      color: isUsed ? '#fcd34d' : '#e2e8f0',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    🧱 Used
                  </button>
                </div>
              </div>

              {/* --- ONE-TAP ORIGINAL BOX TOGGLE FOR SETS --- */}
              {isSet && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    marginBottom: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Original Box</div>
                    <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 600 }}>
                      {hasBox === 'Yes'
                        ? 'Yes — Box Included'
                        : hasBox === 'No'
                        ? 'No — Loose / No Box'
                        : currentCondition === 'New'
                        ? 'Yes (Sealed Default)'
                        : 'Not Set Yet'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() =>
                        handleQuickUpdateSetFields(
                          item,
                          { has_box: hasBox === 'Yes' ? '' : 'Yes' },
                          `Box: ${hasBox === 'Yes' ? 'Cleared' : 'Yes'}`
                        )
                      }
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: hasBox === 'Yes' ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.2)',
                        backgroundColor: hasBox === 'Yes' ? 'rgba(34,197,94,0.28)' : 'rgba(15,23,42,0.5)',
                        color: hasBox === 'Yes' ? '#86efac' : '#e2e8f0',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      📦 Yes
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleQuickUpdateSetFields(
                          item,
                          { has_box: hasBox === 'No' ? '' : 'No' },
                          `Box: ${hasBox === 'No' ? 'Cleared' : 'No'}`
                        )
                      }
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: hasBox === 'No' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.2)',
                        backgroundColor: hasBox === 'No' ? 'rgba(245,158,11,0.28)' : 'rgba(15,23,42,0.5)',
                        color: hasBox === 'No' ? '#fcd34d' : '#e2e8f0',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      🚫 No
                    </button>
                  </div>
                </div>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  padding: '12px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(15,23,42,0.65)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  marginBottom: '14px',
                  textAlign: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Cost ({qty > 1 ? `×${qty}` : 'Each'})</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                    ${totalPosCost.toFixed(2)}
                  </div>
                  {qty > 1 && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>${unitCost.toFixed(2)} ea</div>}
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Market ({currentCondition})</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#60a5fa', marginTop: '2px' }}>
                    ${totalPosMarket.toFixed(2)}
                  </div>
                  {qty > 1 && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>${unitMarket.toFixed(2)} ea</div>}
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Gain / ROI</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: gain >= 0 ? '#4ade80' : '#f87171', marginTop: '2px' }}>
                    {gain >= 0 ? '+' : ''}${gain.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: gain >= 0 ? '#4ade80' : '#f87171' }}>
                    {roiPct !== null ? `${gain >= 0 ? '+' : ''}${roiPct}%` : 'N/A'}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  fontSize: '0.82rem',
                  color: '#cbd5e1',
                  marginBottom: '14px'
                }}
              >
                <span>BrickLink Avg New: <strong style={{ color: '#fff' }}>${(item.market_price_new || 0).toFixed(2)}</strong></span>
                <span>Avg Used: <strong style={{ color: '#fff' }}>${(item.market_price_used || 0).toFixed(2)}</strong></span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem', marginBottom: '14px' }}>
                <div style={{ padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Shelf / Storage</div>
                  <div style={{ fontWeight: 600, color: '#fff', marginTop: '2px' }}>{shelf || 'Unassigned'}</div>
                </div>
                {isSet ? (
                  <div style={{ padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Store / Source</div>
                    <div style={{ fontWeight: 600, color: '#fff', marginTop: '2px' }}>{item.store || '—'}</div>
                  </div>
                ) : (
                  <div style={{ padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Theme</div>
                    <div style={{ fontWeight: 600, color: '#fff', marginTop: '2px' }}>{item.theme || '—'}</div>
                  </div>
                )}
                {isSet && (
                  <div style={{ padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Purchase Date</div>
                    <div style={{ fontWeight: 600, color: '#fff', marginTop: '2px' }}>{item.purchase_dt || '—'}</div>
                  </div>
                )}
              </div>

              {notes && (
                <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '4px' }}>Notes</div>
                  <div style={{ fontSize: '0.88rem', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>{notes}</div>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <a
                  href={blUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ flex: 1, textAlign: 'center', textDecoration: 'none', minWidth: '130px' }}
                >
                  🔗 BrickLink
                </a>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1, minWidth: '100px' }}
                  onClick={() => {
                    const target = item;
                    setDetailItem(null);
                    if (isSet) handleOpenModal(target);
                    else handleOpenFigModal(target);
                  }}
                >
                  ✏️ Edit
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  style={{ flex: 1, minWidth: '100px' }}
                  onClick={() => {
                    const target = item;
                    setDetailItem(null);
                    if (isSet) handleQuickSellSet(target);
                    else handleQuickSellFig(target);
                  }}
                >
                  💰 Sell
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* --- FULL-SCREEN IMAGE ZOOM LIGHTBOX --- */}
      {zoomedImageUrl && (
        <div
          className="modal-overlay"
          onClick={() => setZoomedImageUrl(null)}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.92)',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            cursor: 'zoom-out'
          }}
        >
          <img
            src={zoomedImageUrl}
            alt="Zoomed LEGO item"
            style={{
              maxWidth: '95vw',
              maxHeight: '80vh',
              objectFit: 'contain',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              padding: '12px'
            }}
          />
          <div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginTop: '12px' }}>
            Tap anywhere to close
          </div>
        </div>
      )}

      {/* --- ADD / EDIT SET MODAL --- */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{editingSet ? 'Edit Set' : 'Add New Set'}</h2>
            <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label>Set Number *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. 75192"
                    value={formData.set_number} 
                    onChange={(e) => setFormData({...formData, set_number: e.target.value})} 
                    onBlur={handleLookupSet}
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={handleLookupSet}
                    disabled={isLookingUpSet || !formData.set_number || !isOnline}
                  >
                    {isLookingUpSet ? '...' : '🔍 Lookup'}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Set Name *</label>
                <input type="text" required value={formData.set_name} onChange={(e) => setFormData({...formData, set_name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Theme</label>
                <input type="text" placeholder="e.g. Star Wars, Ninjago, Technic" value={formData.theme} onChange={(e) => setFormData({...formData, theme: e.target.value})} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Quantity</label>
                  <input type="number" min="1" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 1})} />
                </div>
                <div className="form-group">
                  <label>Condition</label>
                  <select
                    value={formData.condition}
                    onChange={(e) => {
                      const nextCond = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        condition: nextCond,
                        has_box: nextCond === 'Used' && !prev.has_box ? 'Yes' : prev.has_box
                      }));
                    }}
                  >
                    <option value="New">New</option>
                    <option value="Used">Used</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Purchase Price ($)</label>
                  <input type="number" step="0.01" value={formData.purchase_price} onChange={(e) => setFormData({...formData, purchase_price: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="form-group">
                  <label>Purchase Date</label>
                  <input type="date" value={formData.purchase_dt} onChange={(e) => setFormData({...formData, purchase_dt: e.target.value})} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Shelf Location</label>
                  <input type="text" value={formData.new_shelf} onChange={(e) => setFormData({...formData, new_shelf: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Store / Source</label>
                  <input type="text" value={formData.store} onChange={(e) => setFormData({...formData, store: e.target.value})} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Polybag?</label>
                  <select value={formData.polybag} onChange={(e) => setFormData({...formData, polybag: e.target.value})}>
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Has Box?</label>
                  <select value={formData.has_box} onChange={(e) => setFormData({...formData, has_box: e.target.value})}>
                    <option value="">{formData.condition === 'New' ? 'Yes (Sealed)' : 'Not Specified'}</option>
                    <option value="Yes">Yes (Box Included)</option>
                    <option value="No">No (Loose / No Box)</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={formData.item_notes} onChange={(e) => setFormData({...formData, item_notes: e.target.value})} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-success">Save Set</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD / EDIT MINIFIG MODAL --- */}
      {isFigModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{editingFig ? 'Edit Minifigure' : 'Add Minifigure'}</h2>
            <form onSubmit={handleFigFormSubmit}>
              <div className="form-group">
                <label>Fig Number *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. sw0001a"
                    value={figFormData.fig_number} 
                    onChange={(e) => setFigFormData({...figFormData, fig_number: e.target.value})} 
                    onBlur={handleLookupFig}
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={handleLookupFig}
                    disabled={isLookingUpFig || !figFormData.fig_number || !isOnline}
                  >
                    {isLookingUpFig ? '...' : '🔍 Lookup'}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Fig Name *</label>
                <input type="text" required value={figFormData.fig_name} onChange={(e) => setFigFormData({...figFormData, fig_name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Theme</label>
                <input type="text" placeholder="e.g. Star Wars, Ninjago, Marvel" value={figFormData.theme} onChange={(e) => setFigFormData({...figFormData, theme: e.target.value})} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Quantity</label>
                  <input type="number" min="1" value={figFormData.quantity} onChange={(e) => setFigFormData({...figFormData, quantity: parseInt(e.target.value) || 1})} />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={figFormData.status} onChange={(e) => setFigFormData({...figFormData, status: e.target.value})}>
                    <option value="In Collection">In Collection</option>
                    <option value="For Sale">For Sale</option>
                    <option value="Draft / Unsorted">Draft / Unsorted</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Condition</label>
                  <select value={figFormData.condition} onChange={(e) => setFigFormData({...figFormData, condition: e.target.value})}>
                    <option value="New">New</option>
                    <option value="Used">Used</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Purchase Price ($)</label>
                  <input type="number" step="0.01" value={figFormData.purchase_price} onChange={(e) => setFigFormData({...figFormData, purchase_price: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
              <div className="form-group">
                <label>Shelf Location</label>
                <input type="text" value={figFormData.shelf_location} onChange={(e) => setFigFormData({...figFormData, shelf_location: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={figFormData.notes} onChange={(e) => setFigFormData({...figFormData, notes: e.target.value})} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsFigModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-success">Save Minifig</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- WISHLIST MODAL --- */}
      {isWishModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{editingWish ? 'Edit Wishlist Item' : 'Add to Wishlist'}</h2>
            <form onSubmit={handleWishFormSubmit}>
              <div className="form-group">
                <label>Item Number *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. 75192 or sw0001a"
                    value={wishFormData.item_number} 
                    onChange={(e) => setWishFormData({...wishFormData, item_number: e.target.value})} 
                    onBlur={handleLookupWish}
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={handleLookupWish}
                    disabled={isLookingUpWish || !wishFormData.item_number || !isOnline}
                  >
                    {isLookingUpWish ? '...' : '🔍 Lookup'}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Item Name *</label>
                <input type="text" required value={wishFormData.item_name} onChange={(e) => setWishFormData({...wishFormData, item_name: e.target.value})} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <select value={wishFormData.item_type} onChange={(e) => setWishFormData({...wishFormData, item_type: e.target.value})}>
                    <option value="SET">SET</option>
                    <option value="MINIFIG">MINIFIG</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select value={wishFormData.priority} onChange={(e) => setWishFormData({...wishFormData, priority: e.target.value})}>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Target Price ($)</label>
                <input type="number" step="0.01" value={wishFormData.target_price} onChange={(e) => setWishFormData({...wishFormData, target_price: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={wishFormData.notes} onChange={(e) => setWishFormData({...wishFormData, notes: e.target.value})} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsWishModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-success">Save Wishlist Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- SALE MODAL (WITH AUTO-INVENTORY DEDUCTION) --- */}
      {isSaleModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{editingSale ? 'Edit Sale Entry' : 'Log New Sale'}</h2>
            <form onSubmit={handleSaleFormSubmit}>
              <div className="form-group">
                <label>Item Number *</label>
                <input type="text" required value={saleFormData.item_number} onChange={(e) => setSaleFormData({...saleFormData, item_number: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Item Name *</label>
                <input type="text" required value={saleFormData.item_name} onChange={(e) => setSaleFormData({...saleFormData, item_name: e.target.value})} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Sale Date</label>
                  <input type="date" required value={saleFormData.sale_date} onChange={(e) => setSaleFormData({...saleFormData, sale_date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Platform</label>
                  <select value={saleFormData.platform} onChange={(e) => setSaleFormData({...saleFormData, platform: e.target.value})}>
                    <option value="eBay">eBay</option>
                    <option value="BrickLink">BrickLink</option>
                    <option value="Local / Cash">Local / Cash</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Sale Price ($)</label>
                  <input type="number" step="0.01" value={saleFormData.sale_price} onChange={(e) => setSaleFormData({...saleFormData, sale_price: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="form-group">
                  <label>Original Cost ($)</label>
                  <input type="number" step="0.01" value={saleFormData.cost_price} onChange={(e) => setSaleFormData({...saleFormData, cost_price: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Platform Fees ($)</label>
                  <input type="number" step="0.01" value={saleFormData.platform_fees} onChange={(e) => setSaleFormData({...saleFormData, platform_fees: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="form-group">
                  <label>Shipping Cost ($)</label>
                  <input type="number" step="0.01" value={saleFormData.shipping_cost} onChange={(e) => setSaleFormData({...saleFormData, shipping_cost: parseFloat(e.target.value) || 0})} />
                </div>
              </div>

              {saleSourceItem && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(59,130,246,0.14)',
                    border: '1px solid rgba(59,130,246,0.35)',
                    marginBottom: '12px'
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={deductFromInventory}
                      onChange={(e) => setDeductFromInventory(e.target.checked)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span>
                      Auto-deduct 1 from inventory (
                      {(saleSourceItem.item.quantity || 1) > 1
                        ? `Qty ${saleSourceItem.item.quantity} → ${(saleSourceItem.item.quantity || 1) - 1}`
                        : 'Qty 1 → Remove item'}
                      )
                    </span>
                  </label>
                </div>
              )}

              <div className="form-group">
                <label>Notes</label>
                <textarea value={saleFormData.notes} onChange={(e) => setSaleFormData({...saleFormData, notes: e.target.value})} />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsSaleModalOpen(false);
                    setSaleSourceItem(null);
                    setDeductFromInventory(false);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-success">Save Sale</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- AI PHOTO SCAN MODAL --- */}
      {isScanModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>📷 AI Minifig Identifier</h2>
            <div className="scan-body">
              <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
              {!previewImage ? (
                <div className="upload-box" onClick={() => fileInputRef.current.click()}>
                  <p>Tap here to take a photo or upload an image of a minifig</p>
                </div>
              ) : (
                <div className="image-preview-container">
                  <img src={previewImage} alt="Preview" className="scan-preview" />
                  <button className="btn btn-secondary btn-sm" onClick={() => setPreviewImage(null)}>Retake Photo</button>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => { setIsScanModalOpen(false); setPreviewImage(null); }}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={!previewImage || isAnalyzing} onClick={handleAnalyzePhoto}>
                {isAnalyzing ? 'Analyzing with AI...' : 'Identify Minifig'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
