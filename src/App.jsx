import React, { useState, useEffect } from 'react';
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

function App() {
  const [activeTab, setActiveTab] = useState('sets');
  
  const [sets, setSets] = useState([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [filterPolybag, setFilterPolybag] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [minifigs, setMinifigs] = useState([]);
  const [loadingMinifigs, setLoadingMinifigs] = useState(false);
  const [minifigSearchQuery, setMinifigSearchQuery] = useState('');

  const [wishlist, setWishlist] = useState([]);
  const [loadingWishlist, setLoadingWishlist] = useState(false);
  const [wishlistSearchQuery, setWishlistSearchQuery] = useState('');

  const [sales, setSales] = useState([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [salesSearchQuery, setSalesSearchQuery] = useState('');

  const [syncStatus, setSyncStatus] = useState('');

  // Modals State
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
    purchase_price: 0.0, shelf_location: '', notes: ''
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

  // --- SET HANDLERS ---
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

  // --- MINIFIG HANDLERS ---
  const handleOpenFigModal = (figItem = null) => {
    if (figItem) {
      setEditingFig(figItem);
      setFigFormData({
        fig_number: figItem.fig_number || '', fig_name: figItem.fig_name || '', quantity: figItem.quantity || 1,
        condition: figItem.condition || 'New', purchase_price: figItem.purchase_price || 0.0,
        shelf_location: figItem.shelf_location || '', notes: figItem.notes || ''
      });
    } else {
      setEditingFig(null);
      setFigFormData({
        fig_number: '', fig_name: '', quantity: 1, condition: 'New', purchase_price: 0.0, shelf_location: '', notes: ''
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

  // --- WISHLIST HANDLERS ---
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

  // --- SALES HANDLERS ---
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

  // --- CALCULATIONS ---
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

  const totalSets = filteredSets.reduce((acc, s) => acc + (s.quantity || 1), 0);
  const totalCost = filteredSets.reduce((acc, s) => acc + ((s.purchase_price || 0) * (s.quantity || 1)), 0);
  const totalMarketVal = filteredSets.reduce((acc, s) => {
    const isUsed = s.condition && s.condition.toLowerCase() === 'used';
    const price = isUsed ? (s.market_price_used || 0) : (s.market_price_new || 0);
    return acc + (price * (s.quantity || 1));
  }, 0);

  const filteredMinifigs = minifigs.filter(f => {
    const q = minifigSearchQuery.toLowerCase();
    return f.fig_name?.toLowerCase().includes(q) || f.fig_number?.toLowerCase().includes(q) || f.notes?.toLowerCase().includes(q);
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

  const totalWishTarget = filteredWishlist.reduce((acc, w) => acc + (w.target_price || 0), 0);

  const filteredSales = sales.filter(s => {
    const q = salesSearchQuery.toLowerCase();
    return s.item_name?.toLowerCase().includes(q) || s.item_number?.toLowerCase().includes(q) || s.platform?.toLowerCase().includes(q) || s.notes?.toLowerCase().includes(q);
  });

  const totalRevenue = filteredSales.reduce((acc, s) => acc + (s.sale_price || 0), 0);
  const totalNetProfit = filteredSales.reduce((acc, s) => acc + (s.net_profit || 0), 0);
  const totalSalesCost = filteredSales.reduce((acc, s) => acc + (s.cost_price || 0), 0);
  const overallROI = totalSalesCost > 0 ? ((totalNetProfit / totalSalesCost) * 100).toFixed(1) : '0.0';

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🧱 LEGO Collection Tracker</h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleSync}>Sync BrickLink Data</button>
        </div>
      </header>

      <nav className="tab-bar">
        <button className={`tab-btn ${activeTab === 'sets' ? 'active' : ''}`} onClick={() => setActiveTab('sets')}>
          📦 Sets ({sets.length})
        </button>
        <button className={`tab-btn ${activeTab === 'minifigs' ? 'active' : ''}`} onClick={() => setActiveTab('minifigs')}>
          🦸 Minifigures ({minifigs.length})
        </button>
        <button className={`tab-btn ${activeTab === 'wishlist' ? 'active' : ''}`} onClick={() => setActiveTab('wishlist')}>
          ⭐ Wishlist ({wishlist.length})
        </button>
        <button className={`tab-btn ${activeTab === 'sales' ? 'active' : ''}`} onClick={() => setActiveTab('sales')}>
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
                  <tr><th>Image</th><th>Set #</th><th>Name</th><th>Qty</th><th>Cond.</th><th>Cost</th><th>Market Value</th><th>Shelf</th><th>Purchased</th><th>Store</th><th>Notes</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filteredSets.map((item) => {
                    const imageUrl = formatImageUrl(item.image_url, item.set_number);
                    const isUsed = item.condition && item.condition.toLowerCase() === 'used';
                    const activeMarketPrice = isUsed ? (item.market_price_used || 0) : (item.market_price_new || 0);
                    return (
                      <tr key={item.id}>
                        <td className="img-cell">{imageUrl ? <img src={imageUrl} alt={item.set_name} className="set-thumbnail" onError={(e) => { e.target.onerror = null; e.target.src = 'https://cdn-icons-png.flaticon.com/512/808/808440.png'; }} /> : <div className="no-img">No Img</div>}</td>
                        <td><strong>{item.set_number}</strong></td><td>{item.set_name}</td><td>{item.quantity}</td><td>{item.condition || 'N/A'}</td>
                        <td>${(item.purchase_price || 0).toFixed(2)}</td><td>${activeMarketPrice.toFixed(2)}</td><td>{item.new_shelf || '-'}</td>
                        <td>{item.purchase_dt || '-'}</td><td>{item.store || '-'}</td><td>{item.item_notes || '-'}</td>
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
            <button className="btn btn-success" onClick={() => handleOpenFigModal()}>+ Add Minifig</button>
          </section>

          {loadingMinifigs ? <div className="loading-spinner">Loading minifigures...</div> : (
            <div className="table-responsive">
              <table className="inventory-table">
                <thead>
                  <tr><th>Image</th><th>Fig #</th><th>Name</th><th>Qty</th><th>Cond.</th><th>Cost</th><th>Market Value</th><th>Shelf</th><th>Notes</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filteredMinifigs.map((item) => {
                    const imageUrl = formatImageUrl(item.image_url, item.fig_number, true);
                    const isUsed = item.condition && item.condition.toLowerCase() === 'used';
                    const activeMarketPrice = isUsed ? (item.market_price_used || 0) : (item.market_price_new || 0);
                    return (
                      <tr key={item.id}>
                        <td className="img-cell">{imageUrl ? <img src={imageUrl} alt={item.fig_name} className="set-thumbnail" onError={(e) => { e.target.onerror = null; e.target.src = 'https://cdn-icons-png.flaticon.com/512/808/808440.png'; }} /> : <div className="no-img">No Img</div>}</td>
                        <td><strong>{item.fig_number}</strong></td><td>{item.fig_name}</td><td>{item.quantity}</td><td>{item.condition || 'N/A'}</td>
                        <td>${(item.purchase_price || 0).toFixed(2)}</td><td>${activeMarketPrice.toFixed(2)}</td><td>{item.shelf_location || '-'}</td><td>{item.notes || '-'}</td>
                        <td className="actions-cell">
                          <button className="btn-icon" onClick={() => handleOpenFigModal(item)}>✏️</button>
                          <button className="btn-icon text-danger" onClick={() => handleDeleteFig(item.id)}>🗑️</button>
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
                  <tr><th>Image</th><th>Item #</th><th>Name</th><th>Type</th><th>Priority</th><th>Target Price</th><th>Market (New)</th><th>Notes</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filteredWishlist.map((item) => {
                    const imageUrl = formatImageUrl(item.image_url, item.item_number, item.item_type === 'MINIFIG');
                    return (
                      <tr key={item.id}>
                        <td className="img-cell">{imageUrl ? <img src={imageUrl} alt={item.item_name} className="set-thumbnail" onError={(e) => { e.target.onerror = null; e.target.src = 'https://cdn-icons-png.flaticon.com/512/808/808440.png'; }} /> : <div className="no-img">No Img</div>}</td>
                        <td><strong>{item.item_number}</strong></td><td>{item.item_name}</td><td>{item.item_type}</td><td>{item.priority}</td>
                        <td>${(item.target_price || 0).toFixed(2)}</td><td>${(item.market_price_new || 0).toFixed(2)}</td><td>{item.notes || '-'}</td>
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
            <div className="stat-card"><h3>Total Sales</h3><p>{filteredSales.length}</p></div>
            <div className="stat-card"><h3>Total Revenue</h3><p>${totalRevenue.toFixed(2)}</p></div>
            <div className="stat-card"><h3>Net Profit</h3><p style={{ color: totalNetProfit >= 0 ? '#28a745' : '#dc3545' }}>${totalNetProfit.toFixed(2)}</p></div>
            <div className="stat-card"><h3>ROI</h3><p>{overallROI}%</p></div>
          </section>

          <section className="controls-row">
            <input type="text" placeholder="Search sales..." value={salesSearchQuery} onChange={(e) => setSalesSearchQuery(e.target.value)} className="search-input" />
            <button className="btn btn-success" onClick={() => handleOpenSaleModal()}>+ Add Sale</button>
          </section>

          {loadingSales ? <div className="loading-spinner">Loading sales log...</div> : (
            <div className="table-responsive">
              <table className="inventory-table">
                <thead>
                  <tr><th>Date</th><th>Item #</th><th>Name</th><th>Platform</th><th>Gross Sale</th><th>Cost</th><th>Fees</th><th>Shipping</th><th>Net Profit</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filteredSales.map((item) => (
                    <tr key={item.id}>
                      <td>{item.sale_date || '-'}</td>
                      <td><strong>{item.item_number}</strong></td>
                      <td>{item.item_name}</td>
                      <td>{item.platform || '-'}</td>
                      <td>${(item.sale_price || 0).toFixed(2)}</td>
                      <td>${(item.cost_price || 0).toFixed(2)}</td>
                      <td>${(item.platform_fees || 0).toFixed(2)}</td>
                      <td>${(item.shipping_cost || 0).toFixed(2)}</td>
                      <td style={{ color: (item.net_profit || 0) >= 0 ? '#28a745' : '#dc3545', fontWeight: 'bold' }}>
                        ${(item.net_profit || 0).toFixed(2)}
                      </td>
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

      {/* Add / Edit Set Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2>{editingSet ? 'Edit Set' : 'Add New Set'}</h2>
            <form onSubmit={handleFormSubmit}>
              <div className="form-group"><label>Set Number</label><input type="text" required value={formData.set_number} onChange={(e) => setFormData({...formData, set_number: e.target.value})}/></div>
              <div className="form-group"><label>Set Name</label><input type="text" required value={formData.set_name} onChange={(e) => setFormData({...formData, set_name: e.target.value})}/></div>
              <div className="form-row">
                <div className="form-group"><label>Quantity</label><input type="number" min="1" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 1})}/></div>
                <div className="form-group"><label>Condition</label><select value={formData.condition} onChange={(e) => setFormData({...formData, condition: e.target.value})}><option value="New">New</option><option value="Used">Used</option></select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Purchase Price ($)</label><input type="number" step="0.01" value={formData.purchase_price} onChange={(e) => setFormData({...formData, purchase_price: parseFloat(e.target.value) || 0.0})}/></div>
                <div className="form-group"><label>Purchase Date</label><input type="date" value={formData.purchase_dt} onChange={(e) => setFormData({...formData, purchase_dt: e.target.value})}/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Store Purchased</label><input type="text" value={formData.store} onChange={(e) => setFormData({...formData, store: e.target.value})}/></div>
                <div className="form-group"><label>Shelf Location</label><input type="text" value={formData.new_shelf} onChange={(e) => setFormData({...formData, new_shelf: e.target.value})}/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Polybag?</label><select value={formData.polybag} onChange={(e) => setFormData({...formData, polybag: e.target.value})}><option value="No">No</option><option value="Yes">Yes</option></select></div>
              </div>
              <div className="form-group"><label>Item Notes</label><textarea rows="2" value={formData.item_notes} onChange={(e) => setFormData({...formData, item_notes: e.target.value})}/></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Set</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Minifig Modal */}
      {isFigModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2>{editingFig ? 'Edit Minifigure' : 'Add New Minifigure'}</h2>
            <form onSubmit={handleFigFormSubmit}>
              <div className="form-group"><label>Fig Number (e.g. sw0001a)</label><input type="text" required value={figFormData.fig_number} onChange={(e) => setFigFormData({...figFormData, fig_number: e.target.value})}/></div>
              <div className="form-group"><label>Minifigure Name</label><input type="text" required value={figFormData.fig_name} onChange={(e) => setFigFormData({...figFormData, fig_name: e.target.value})}/></div>
              <div className="form-row">
                <div className="form-group"><label>Quantity</label><input type="number" min="1" value={figFormData.quantity} onChange={(e) => setFigFormData({...figFormData, quantity: parseInt(e.target.value) || 1})}/></div>
                <div className="form-group"><label>Condition</label><select value={figFormData.condition} onChange={(e) => setFigFormData({...figFormData, condition: e.target.value})}><option value="New">New</option><option value="Used">Used</option></select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Purchase Price ($)</label><input type="number" step="0.01" value={figFormData.purchase_price} onChange={(e) => setFigFormData({...figFormData, purchase_price: parseFloat(e.target.value) || 0.0})}/></div>
                <div className="form-group"><label>Shelf Location</label><input type="text" value={figFormData.shelf_location} onChange={(e) => setFigFormData({...figFormData, shelf_location: e.target.value})}/></div>
              </div>
              <div className="form-group"><label>Notes</label><textarea rows="2" value={figFormData.notes} onChange={(e) => setFigFormData({...figFormData, notes: e.target.value})}/></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsFigModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Minifigure</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Wishlist Modal */}
      {isWishModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2>{editingWish ? 'Edit Wishlist Item' : 'Add to Wishlist'}</h2>
            <form onSubmit={handleWishFormSubmit}>
              <div className="form-row">
                <div className="form-group"><label>Item Number</label><input type="text" required value={wishFormData.item_number} onChange={(e) => setWishFormData({...wishFormData, item_number: e.target.value})}/></div>
                <div className="form-group"><label>Item Type</label><select value={wishFormData.item_type} onChange={(e) => setWishFormData({...wishFormData, item_type: e.target.value})}><option value="SET">Set</option><option value="MINIFIG">Minifigure</option></select></div>
              </div>
              <div className="form-group"><label>Item Name</label><input type="text" required value={wishFormData.item_name} onChange={(e) => setWishFormData({...wishFormData, item_name: e.target.value})}/></div>
              <div className="form-row">
                <div className="form-group"><label>Target Price ($)</label><input type="number" step="0.01" value={wishFormData.target_price} onChange={(e) => setWishFormData({...wishFormData, target_price: parseFloat(e.target.value) || 0.0})}/></div>
                <div className="form-group"><label>Priority</label><select value={wishFormData.priority} onChange={(e) => setWishFormData({...wishFormData, priority: e.target.value})}><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></div>
              </div>
              <div className="form-group"><label>Notes / Deal Criteria</label><textarea rows="2" value={wishFormData.notes} onChange={(e) => setWishFormData({...wishFormData, notes: e.target.value})}/></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsWishModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save to Wishlist</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Sale Modal */}
      {isSaleModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2>{editingSale ? 'Edit Sale Entry' : 'Log New Sale'}</h2>
            <form onSubmit={handleSaleFormSubmit}>
              <div className="form-row">
                <div className="form-group"><label>Item Number</label><input type="text" required value={saleFormData.item_number} onChange={(e) => setSaleFormData({...saleFormData, item_number: e.target.value})}/></div>
                <div className="form-group"><label>Item Type</label><select value={saleFormData.item_type} onChange={(e) => setSaleFormData({...saleFormData, item_type: e.target.value})}><option value="SET">Set</option><option value="MINIFIG">Minifigure</option></select></div>
              </div>
              <div className="form-group"><label>Item Name</label><input type="text" required value={saleFormData.item_name} onChange={(e) => setSaleFormData({...saleFormData, item_name: e.target.value})}/></div>
              <div className="form-row">
                <div className="form-group"><label>Sale Date</label><input type="date" value={saleFormData.sale_date} onChange={(e) => setSaleFormData({...saleFormData, sale_date: e.target.value})}/></div>
                <div className="form-group"><label>Platform</label><select value={saleFormData.platform} onChange={(e) => setSaleFormData({...saleFormData, platform: e.target.value})}><option value="eBay">eBay</option><option value="BrickLink">BrickLink</option><option value="Mercari">Mercari</option><option value="Local">Local/Cash</option><option value="Other">Other</option></select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Gross Sale Price ($)</label><input type="number" step="0.01" value={saleFormData.sale_price} onChange={(e) => setSaleFormData({...saleFormData, sale_price: parseFloat(e.target.value) || 0.0})}/></div>
                <div className="form-group"><label>Item Cost ($)</label><input type="number" step="0.01" value={saleFormData.cost_price} onChange={(e) => setSaleFormData({...saleFormData, cost_price: parseFloat(e.target.value) || 0.0})}/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Platform Fees ($)</label><input type="number" step="0.01" value={saleFormData.platform_fees} onChange={(e) => setSaleFormData({...saleFormData, platform_fees: parseFloat(e.target.value) || 0.0})}/></div>
                <div className="form-group"><label>Shipping Cost ($)</label><input type="number" step="0.01" value={saleFormData.shipping_cost} onChange={(e) => setSaleFormData({...saleFormData, shipping_cost: parseFloat(e.target.value) || 0.0})}/></div>
              </div>
              <div className="form-group"><label>Notes</label><textarea rows="2" value={saleFormData.notes} onChange={(e) => setSaleFormData({...saleFormData, notes: e.target.value})}/></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsSaleModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Sale</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
