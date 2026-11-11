import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_BASE = "https://lego-inventory-backend.onrender.com";

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

const exportToCSV = (data, filename = 'lego_inventory.csv') => {
  if (!data || !data.length) {
    alert("No data available to export.");
    return;
  }
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => 
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
};

function App() {
  const [activeTab, setActiveTab] = useState('sets');
  
  const [sets, setSets] = useState([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [filterPolybag, setFilterPolybag] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [minifigs, setMinifigs] = useState([]);
  const [loadingMinifigs, setLoadingMinifigs] = useState(false);
  const [minifigSearchQuery, setMinifigSearchQuery] = useState('');
  const [minifigStatusFilter, setMinifigStatusFilter] = useState('ALL');

  const [wishlist, setWishlist] = useState([]);
  const [loadingWishlist, setLoadingWishlist] = useState(false);
  const [wishlistSearchQuery, setWishlistSearchQuery] = useState('');

  const [sales, setSales] = useState([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [salesSearchQuery, setSalesSearchQuery] = useState('');

  const [syncStatus, setSyncStatus] = useState('');

  const [sortField, setSortField] = useState('set_number');
  const [sortOrder, setSortOrder] = useState('asc');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSet, setEditingSet] = useState(null);
  const [formData, setFormData] = useState({
    set_number: '', set_name: '', quantity: 1, condition: 'New',
    purchase_price: 0.0, purchase_dt: '', new_shelf: '', item_notes: '', store: '', polybag: 'No'
  });

  const [isFigModalOpen, setIsFigModalOpen] = useState(false);
  const [editingFig, setEditingFig] = useState(null);
  const [figFormData, setFigFormData] = useState({
    fig_number: '', fig_name: '', quantity: 1, condition: 'New',
    purchase_price: 0.0, shelf_location: '', notes: '', status: 'In Collection'
  });

  const [isWishModalOpen, setIsWishModalOpen] = useState(false);
  const [editingWish, setEditingWish] = useState(null);
  const [wishFormData, setWishFormData] = useState({
    item_number: '', item_name: '', item_type: 'SET', target_price: 0.0, priority: 'Medium', notes: ''
  });

  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [saleFormData, setSaleFormData] = useState({
    item_number: '', item_name: '', item_type: 'SET', sale_date: '',
    sale_price: 0.0, cost_price: 0.0, platform_fees: 0.0, shipping_cost: 0.0, platform: 'eBay', notes: ''
  });

  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef(null);

  const fetchSets = async () => {
    setLoadingSets(true);
    try {
      const res = await fetch(`${API_BASE}/sets`);
      if (res.ok) setSets(await res.json());
    } catch (err) { console.error(err); } finally { setLoadingSets(false); }
  };

  const fetchMinifigs = async () => {
    setLoadingMinifigs(true);
    try {
      const res = await fetch(`${API_BASE}/minifigs`);
      if (res.ok) setMinifigs(await res.json());
    } catch (err) { console.error(err); } finally { setLoadingMinifigs(false); }
  };

  const fetchWishlist = async () => {
    setLoadingWishlist(true);
    try {
      const res = await fetch(`${API_BASE}/wishlist`);
      if (res.ok) setWishlist(await res.json());
    } catch (err) { console.error(err); } finally { setLoadingWishlist(false); }
  };

  const fetchSales = async () => {
    setLoadingSales(true);
    try {
      const res = await fetch(`${API_BASE}/sales`);
      if (res.ok) setSales(await res.json());
    } catch (err) { console.error(err); } finally { setLoadingSales(false); }
  };

  useEffect(() => {
    fetchSets();
    fetchMinifigs();
    fetchWishlist();
    fetchSales();
  }, []);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleSync = async () => {
    setSyncStatus('Syncing with BrickLink API...');
    try {
      const res = await fetch(`${API_BASE}/sync-bricklink`, { method: 'POST' });
      const data = await res.json();
      setSyncStatus(data.message || 'Sync completed.');
      fetchSets();
      fetchMinifigs();
      fetchWishlist();
    } catch (err) {
      setSyncStatus('Error syncing with BrickLink.');
    }
  };

  const handleOpenModal = (setItem = null) => {
    if (setItem) {
      setEditingSet(setItem);
      setFormData({
        set_number: setItem.set_number || '', set_name: setItem.set_name || '', quantity: setItem.quantity || 1,
        condition: setItem.condition || 'New', purchase_price: setItem.purchase_price || 0.0,
        purchase_dt: setItem.purchase_dt || '', new_shelf: setItem.new_shelf || '',
        item_notes: setItem.item_notes || '', store: setItem.store || '', polybag: setItem.polybag || 'No'
      });
    } else {
      setEditingSet(null);
      setFormData({
        set_number: '', set_name: '', quantity: 1, condition: 'New', purchase_price: 0.0,
        purchase_dt: '', new_shelf: '', item_notes: '', store: '', polybag: 'No'
      });
    }
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const endpoint = editingSet ? `${API_BASE}/sets/${editingSet.id}` : `${API_BASE}/add-set`;
    const method = editingSet ? 'PUT' : 'POST';
    try {
      const res = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      if (res.ok) { setIsModalOpen(false); fetchSets(); }
    } catch (err) { console.error(err); }
  };

  const handleDeleteSet = async (id) => {
    if (!window.confirm("Delete this set?")) return;
    try {
      const res = await fetch(`${API_BASE}/sets/${id}`, { method: 'DELETE' });
      if (res.ok) fetchSets();
    } catch (err) { console.error(err); }
  };

  const handleOpenFigModal = (figItem = null) => {
    if (figItem) {
      setEditingFig(figItem);
      setFigFormData({
        fig_number: figItem.fig_number || '', fig_name: figItem.fig_name || '', quantity: figItem.quantity || 1,
        condition: figItem.condition || 'New', purchase_price: figItem.purchase_price || 0.0,
        shelf_location: figItem.shelf_location || '', notes: figItem.notes || '', status: figItem.status || 'In Collection'
      });
    } else {
      setEditingFig(null);
      setFigFormData({
        fig_number: '', fig_name: '', quantity: 1, condition: 'New', purchase_price: 0.0, shelf_location: '', notes: '', status: 'In Collection'
      });
    }
    setIsFigModalOpen(true);
  };

  const handleFigFormSubmit = async (e) => {
    e.preventDefault();
    const endpoint = editingFig ? `${API_BASE}/minifigs/${editingFig.id}` : `${API_BASE}/add-minifig`;
    const method = editingFig ? 'PUT' : 'POST';
    try {
      const res = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(figFormData) });
      if (res.ok) { setIsFigModalOpen(false); fetchMinifigs(); }
    } catch (err) { console.error(err); }
  };

  const handleDeleteFig = async (id) => {
    if (!window.confirm("Delete this minifigure?")) return;
    try {
      const res = await fetch(`${API_BASE}/minifigs/${id}`, { method: 'DELETE' });
      if (res.ok) fetchMinifigs();
    } catch (err) { console.error(err); }
  };

  const handleQuickSellFig = (figItem) => {
    setEditingSale(null);
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
        fig_number: data.fig_number || 'sw0001a',
        fig_name: data.fig_name || 'Darth Vader (Classic)',
        quantity: 1,
        condition: 'New',
        purchase_price: 0.0,
        shelf_location: 'Bin 1',
        notes: `Identified via AI Vision (${data.confidence || '95%'} confidence)`,
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

  const handleWishFormSubmit = async (e) => {
    e.preventDefault();
    const endpoint = editingWish ? `${API_BASE}/wishlist/${editingWish.id}` : `${API_BASE}/add-wishlist`;
    const method = editingWish ? 'PUT' : 'POST';
    try {
      const res = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(wishFormData) });
      if (res.ok) { setIsWishModalOpen(false); fetchWishlist(); }
    } catch (err) { console.error(err); }
  };

  const handleDeleteWish = async (id) => {
    if (!window.confirm("Delete this wishlist item?")) return;
    try {
      const res = await fetch(`${API_BASE}/wishlist/${id}`, { method: 'DELETE' });
      if (res.ok) fetchWishlist();
    } catch (err) { console.error(err); }
  };

  const handleOpenSaleModal = (saleItem = null) => {
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

  const handleSaleFormSubmit = async (e) => {
    e.preventDefault();
    const endpoint = editingSale ? `${API_BASE}/sales/${editingSale.id}` : `${API_BASE}/add-sale`;
    const method = editingSale ? 'PUT' : 'POST';
    try {
      const res = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(saleFormData) });
      if (res.ok) { setIsSaleModalOpen(false); fetchSales(); }
    } catch (err) { console.error(err); }
  };

  const handleDeleteSale = async (id) => {
    if (!window.confirm("Delete this sale entry?")) return;
    try {
      const res = await fetch(`${API_BASE}/sales/${id}`, { method: 'DELETE' });
      if (res.ok) fetchSales();
    } catch (err) { console.error(err); }
  };

  const sortData = (data, getValFunc) => {
    return [...data].sort((a, b) => {
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

  const filteredSets = sets.filter(s => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = s.set_name?.toLowerCase().includes(q) || 
                          s.set_number?.toLowerCase().includes(q) ||
                          s.store?.toLowerCase().includes(q) ||
                          s.item_notes?.toLowerCase().includes(q);
    if (filterPolybag === 'YES') return matchesSearch && (s.polybag?.toLowerCase() === 'yes' || s.polybag?.toLowerCase() === 'true');
    if (filterPolybag === 'NO') return matchesSearch && (!s.polybag || s.polybag?.toLowerCase() === 'no' || s.polybag?.toLowerCase() === 'false');
    return matchesSearch;
  });

  const sortedSets = sortData(filteredSets, (item, field) => {
    if (field === 'market_price') {
      const isUsed = item.condition && item.condition.toLowerCase() === 'used';
      return isUsed ? (item.market_price_used || 0) : (item.market_price_new || 0);
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
    const matchesSearch = f.fig_name?.toLowerCase().includes(q) || f.fig_number?.toLowerCase().includes(q) || f.notes?.toLowerCase().includes(q);
    if (minifigStatusFilter !== 'ALL') {
      return matchesSearch && (f.status || 'In Collection') === minifigStatusFilter;
    }
    return matchesSearch;
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

  const renderSortArrow = (field) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🧱 LEGO Collection Tracker</h1>
        <div className="header-actions">
          <button 
            className="btn btn-secondary" 
            onClick={() => exportToCSV(
              activeTab === 'minifigs' ? minifigs : 
              activeTab === 'wishlist' ? wishlist : 
              activeTab === 'sales' ? sales : sets, 
              `${activeTab}_export.csv`
            )}
          >
            📥 Export {activeTab.toUpperCase()} CSV
          </button>
          <button className="btn btn-primary" onClick={handleSync}>Sync BrickLink Data</button>
        </div>
      </header>

      <nav className="tab-bar">
        <button className={`tab-btn ${activeTab === 'sets' ? 'active' : ''}`} onClick={() => { setActiveTab('sets'); setSortField('set_number'); }}>
          📦 Sets ({sets.length})
        </button>
        <button className={`tab-btn ${activeTab === 'minifigs' ? 'active' : ''}`} onClick={() => { setActiveTab('minifigs'); setSortField('fig_number'); }}>
          🦸 Minifigures ({minifigs.length})
        </button>
        <button className={`tab-btn ${activeTab === 'wishlist' ? 'active' : ''}`} onClick={() => { setActiveTab('wishlist'); setSortField('item_number'); }}>
          ⭐ Wishlist ({wishlist.length})
        </button>
        <button className={`tab-btn ${activeTab === 'sales' ? 'active' : ''}`} onClick={() => { setActiveTab('sales'); setSortField('sale_date'); }}>
          💰 Sales Log ({sales.length})
        </button>
      </nav>

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
            <input type="text" placeholder="Search name, set #, store, notes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
            <div className="filter-group">
              <label>Polybag:</label>
              <select value={filterPolybag} onChange={(e) => setFilterPolybag(e.target.value)}>
                <option value="ALL">All</option><option value="YES">Polybags Only</option><option value="NO">Sets Only</option>
              </select>
            </div>
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
                    <th onClick={() => handleSort('purchase_price')} style={{ cursor: 'pointer' }}>Cost{renderSortArrow('purchase_price')}</th>
                    <th onClick={() => handleSort('market_price')} style={{ cursor: 'pointer' }}>Market Value{renderSortArrow('market_price')}</th>
                    <th onClick={() => handleSort('new_shelf')} style={{ cursor: 'pointer' }}>Shelf{renderSortArrow('new_shelf')}</th>
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
                    return (
                      <tr key={item.id}>
                        <td className="img-cell">{imageUrl ? <img src={imageUrl} alt={item.set_name} className="set-thumbnail" onError={(e) => { e.target.onerror = null; e.target.src = 'https://cdn-icons-png.flaticon.com/512/808/808440.png'; }} /> : <div className="no-img">No Img</div>}</td>
                        <td><strong>{item.set_number}</strong></td>
                        <td>{item.set_name}</td>
                        <td>{item.quantity}</td>
                        <td>{item.condition || 'N/A'}</td>
                        <td>${(item.purchase_price || 0).toFixed(2)}</td>
                        <td>${activeMarketPrice.toFixed(2)}</td>
                        <td>{item.new_shelf || '-'}</td>
                        <td>{item.purchase_dt || '-'}</td>
                        <td>{item.store || '-'}</td>
                        <td>{item.item_notes || '-'}</td>
                        <td className="actions-cell">
                          <button className="btn-icon" onClick={() => handleOpenModal(item)}>✏️</button>
                          <button className="btn-icon text-danger" onClick={() => handleDeleteSet(item.id)}>🗑️</button>
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
            <input type="text" placeholder="Search minifigs..." value={minifigSearchQuery} onChange={(e) => setMinifigSearchQuery(e.target.value)} className="search-input" />
            <div className="filter-group">
              <label>Status:</label>
              <select value={minifigStatusFilter} onChange={(e) => setMinifigStatusFilter(e.target.value)}>
                <option value="ALL">All Statuses</option>
                <option value="In Collection">In Collection</option>
                <option value="For Sale">For Sale</option>
                <option value="Draft / Unsorted">Draft / Unsorted</option>
              </select>
            </div>
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
                      <tr key={item.id}>
                        <td className="img-cell">{imageUrl ? <img src={imageUrl} alt={item.fig_name} className="set-thumbnail" onError={(e) => { e.target.onerror = null; e.target.src = 'https://cdn-icons-png.flaticon.com/512/808/808440.png'; }} /> : <div className="no-img">No Img</div>}</td>
                        <td><strong>{item.fig_number}</strong></td>
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
                        <td>{item.notes || '-'}</td>
                        <td className="actions-cell">
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

      {/* TAB 3: WISHLIST */}
      {activeTab === 'wishlist' && (
        <>
          <section className="stats-row">
            <div className="stat-card"><h3>Wishlist Items</h3><p>{filteredWishlist.length}</p></div>
            <div className="stat-card"><h3>Total Target Cost</h3><p>${totalWishTarget.toFixed(2)}</p></div>
          </section>

          <section className="controls-row">
            <input type="text" placeholder="Search wishlist items..." value={wishlistSearchQuery} onChange={(e) => setWishlistSearchQuery(e.target.value)} className="search-input" />
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
                        <td><strong>{item.item_number}</strong></td>
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

      {/* TAB 4: SALES LOG */}
      {activeTab === 'sales' && (
        <>
          <section className="stats-row">
            <div className="stat-card"><h3>Total Revenue</h3><p>${totalRevenue.toFixed(2)}</p></div>
            <div className="stat-card"><h3>Net Profit</h3><p>${totalNetProfit.toFixed(2)}</p></div>
            <div className="stat-card"><h3>Overall ROI</h3><p>{overallROI}%</p></div>
          </section>

          <section className="controls-row">
            <input type="text" placeholder="Search sales log..." value={salesSearchQuery} onChange={(e) => setSalesSearchQuery(e.target.value)} className="search-input" />
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
                      <td><strong>{item.item_number}</strong></td>
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

      {/* --- ADD / EDIT SET MODAL --- */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{editingSet ? 'Edit Set' : 'Add New Set'}</h2>
            <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label>Set Number *</label>
                <input type="text" required value={formData.set_number} onChange={(e) => setFormData({...formData, set_number: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Set Name *</label>
                <input type="text" required value={formData.set_name} onChange={(e) => setFormData({...formData, set_name: e.target.value})} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Quantity</label>
                  <input type="number" min="1" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 1})} />
                </div>
                <div className="form-group">
                  <label>Condition</label>
                  <select value={formData.condition} onChange={(e) => setFormData({...formData, condition: e.target.value})}>
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
              <div className="form-group">
                <label>Polybag?</label>
                <select value={formData.polybag} onChange={(e) => setFormData({...formData, polybag: e.target.value})}>
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
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
                <input type="text" required value={figFormData.fig_number} onChange={(e) => setFigFormData({...figFormData, fig_number: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Fig Name *</label>
                <input type="text" required value={figFormData.fig_name} onChange={(e) => setFigFormData({...figFormData, fig_name: e.target.value})} />
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
                <input type="text" required value={wishFormData.item_number} onChange={(e) => setWishFormData({...wishFormData, item_number: e.target.value})} />
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

      {/* --- SALE MODAL --- */}
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
              <div className="form-group">
                <label>Notes</label>
                <textarea value={saleFormData.notes} onChange={(e) => setSaleFormData({...saleFormData, notes: e.target.value})} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsSaleModalOpen(false)}>Cancel</button>
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
