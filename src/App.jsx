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
  const [activeTab, setActiveTab] = useState('sets'); // 'sets', 'minifigs', 'wishlist', 'sales'
  
  // Sets State
  const [sets, setSets] = useState([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [filterPolybag, setFilterPolybag] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Minifigs State
  const [minifigs, setMinifigs] = useState([]);
  const [loadingMinifigs, setLoadingMinifigs] = useState(false);
  const [minifigSearchQuery, setMinifigSearchQuery] = useState('');

  // Global Sync Status
  const [syncStatus, setSyncStatus] = useState('');

  // Modal State for Sets
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSet, setEditingSet] = useState(null);
  const [formData, setFormData] = useState({
    set_number: '', set_name: '', quantity: 1, condition: 'New',
    purchase_price: 0.0, purchase_dt: '', new_shelf: '', item_notes: '', store: '', polybag: 'No'
  });

  // Modal State for Minifigs
  const [isFigModalOpen, setIsFigModalOpen] = useState(false);
  const [editingFig, setEditingFig] = useState(null);
  const [figFormData, setFigFormData] = useState({
    fig_number: '', fig_name: '', quantity: 1, condition: 'New',
    purchase_price: 0.0, shelf_location: '', notes: ''
  });

  // Fetch Sets
  const fetchSets = async () => {
    setLoadingSets(true);
    try {
      const res = await fetch(`${API_BASE}/sets`);
      if (res.ok) setSets(await res.json());
    } catch (err) {
      console.error("Error fetching sets:", err);
    } finally {
      setLoadingSets(false);
    }
  };

  // Fetch Minifigs
  const fetchMinifigs = async () => {
    setLoadingMinifigs(true);
    try {
      const res = await fetch(`${API_BASE}/minifigs`);
      if (res.ok) setMinifigs(await res.json());
    } catch (err) {
      console.error("Error fetching minifigs:", err);
    } finally {
      setLoadingMinifigs(false);
    }
  };

  useEffect(() => {
    fetchSets();
    fetchMinifigs();
  }, []);

  const handleSync = async () => {
    setSyncStatus('Syncing with BrickLink API...');
    try {
      const res = await fetch(`${API_BASE}/sync-bricklink`, { method: 'POST' });
      const data = await res.json();
      setSyncStatus(data.message || 'Sync completed.');
      fetchSets();
      fetchMinifigs();
    } catch (err) {
      setSyncStatus('Error syncing with BrickLink.');
    }
  };

  // --- SET HANDLERS ---
  const handleOpenModal = (setItem = null) => {
    if (setItem) {
      setEditingSet(setItem);
      setFormData({
        set_number: setItem.set_number || '',
        set_name: setItem.set_name || '',
        quantity: setItem.quantity || 1,
        condition: setItem.condition || 'New',
        purchase_price: setItem.purchase_price || 0.0,
        purchase_dt: setItem.purchase_dt || '',
        new_shelf: setItem.new_shelf || '',
        item_notes: setItem.item_notes || '',
        store: setItem.store || '',
        polybag: setItem.polybag || 'No'
      });
    } else {
      setEditingSet(null);
      setFormData({
        set_number: '', set_name: '', quantity: 1, condition: 'New',
        purchase_price: 0.0, purchase_dt: '', new_shelf: '', item_notes: '', store: '', polybag: 'No'
      });
    }
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const endpoint = editingSet ? `${API_BASE}/sets/${editingSet.id}` : `${API_BASE}/add-set`;
    const method = editingSet ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchSets();
      }
    } catch (err) {
      console.error("Error saving set:", err);
    }
  };

  const handleDeleteSet = async (id) => {
    if (!window.confirm("Delete this set?")) return;
    try {
      const res = await fetch(`${API_BASE}/sets/${id}`, { method: 'DELETE' });
      if (res.ok) fetchSets();
    } catch (err) {
      console.error("Error deleting set:", err);
    }
  };

  // --- MINIFIG HANDLERS ---
  const handleOpenFigModal = (figItem = null) => {
    if (figItem) {
      setEditingFig(figItem);
      setFigFormData({
        fig_number: figItem.fig_number || '',
        fig_name: figItem.fig_name || '',
        quantity: figItem.quantity || 1,
        condition: figItem.condition || 'New',
        purchase_price: figItem.purchase_price || 0.0,
        shelf_location: figItem.shelf_location || '',
        notes: figItem.notes || ''
      });
    } else {
      setEditingFig(null);
      setFigFormData({
        fig_number: '', fig_name: '', quantity: 1, condition: 'New',
        purchase_price: 0.0, shelf_location: '', notes: ''
      });
    }
    setIsFigModalOpen(true);
  };

  const handleFigFormSubmit = async (e) => {
    e.preventDefault();
    const endpoint = editingFig ? `${API_BASE}/minifigs/${editingFig.id}` : `${API_BASE}/add-minifig`;
    const method = editingFig ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(figFormData)
      });
      if (res.ok) {
        setIsFigModalOpen(false);
        fetchMinifigs();
      }
    } catch (err) {
      console.error("Error saving minifig:", err);
    }
  };

  const handleDeleteFig = async (id) => {
    if (!window.confirm("Delete this minifigure?")) return;
    try {
      const res = await fetch(`${API_BASE}/minifigs/${id}`, { method: 'DELETE' });
      if (res.ok) fetchMinifigs();
    } catch (err) {
      console.error("Error deleting minifig:", err);
    }
  };

  // --- FILTER & CALCULATIONS ---
  const filteredSets = sets.filter(s => {
    const matchesSearch = s.set_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.set_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.store?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.item_notes?.toLowerCase().includes(searchQuery.toLowerCase());
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

  const filteredMinifigs = minifigs.filter(f => 
    f.fig_name?.toLowerCase().includes(minifigSearchQuery.toLowerCase()) || 
    f.fig_number?.toLowerCase().includes(minifigSearchQuery.toLowerCase()) ||
    f.notes?.toLowerCase().includes(minifigSearchQuery.toLowerCase())
  );

  const totalFigQty = filteredMinifigs.reduce((acc, f) => acc + (f.quantity || 1), 0);
  const totalFigCost = filteredMinifigs.reduce((acc, f) => acc + ((f.purchase_price || 0) * (f.quantity || 1)), 0);
  const totalFigMarketVal = filteredMinifigs.reduce((acc, f) => {
    const isUsed = f.condition && f.condition.toLowerCase() === 'used';
    const price = isUsed ? (f.market_price_used || 0) : (f.market_price_new || 0);
    return acc + (price * (f.quantity || 1));
  }, 0);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🧱 LEGO Collection Tracker</h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleSync}>Sync BrickLink Data</button>
        </div>
      </header>

      {/* Navigation Tab Bar */}
      <nav className="tab-bar">
        <button className={`tab-btn ${activeTab === 'sets' ? 'active' : ''}`} onClick={() => setActiveTab('sets')}>
          📦 Sets ({sets.length})
        </button>
        <button className={`tab-btn ${activeTab === 'minifigs' ? 'active' : ''}`} onClick={() => setActiveTab('minifigs')}>
          🦸 Minifigures ({minifigs.length})
        </button>
        <button className={`tab-btn ${activeTab === 'wishlist' ? 'active' : ''}`} onClick={() => setActiveTab('wishlist')}>
          ⭐ Wishlist
        </button>
        <button className={`tab-btn ${activeTab === 'sales' ? 'active' : ''}`} onClick={() => setActiveTab('sales')}>
          💰 Sales Log
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
            <input 
              type="text" placeholder="Search name, set #, store, or notes..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} className="search-input"
            />
            <div className="filter-group">
              <label>Polybag:</label>
              <select value={filterPolybag} onChange={(e) => setFilterPolybag(e.target.value)}>
                <option value="ALL">All</option>
                <option value="YES">Polybags Only</option>
                <option value="NO">Sets Only</option>
              </select>
            </div>
            <button className="btn btn-success" onClick={() => handleOpenModal()}>+ Add Set</button>
          </section>

          {loadingSets ? (
            <div className="loading-spinner">Loading inventory...</div>
          ) : (
            <div className="table-responsive">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Set #</th>
                    <th>Name</th>
                    <th>Qty</th>
                    <th>Cond.</th>
                    <th>Cost</th>
                    <th>Market Value</th>
                    <th>Shelf</th>
                    <th>Purchased</th>
                    <th>Store</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSets.map((item) => {
                    const imageUrl = formatImageUrl(item.image_url, item.set_number);
                    const isUsed = item.condition && item.condition.toLowerCase() === 'used';
                    const activeMarketPrice = isUsed ? (item.market_price_used || 0) : (item.market_price_new || 0);

                    return (
                      <tr key={item.id}>
                        <td className="img-cell">
                          {imageUrl ? (
                            <img src={imageUrl} alt={item.set_name} className="set-thumbnail"
                              onError={(e) => { e.target.onerror = null; e.target.src = 'https://cdn-icons-png.flaticon.com/512/808/808440.png'; }}
                            />
                          ) : <div className="no-img">No Img</div>}
                        </td>
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
            <input 
              type="text" placeholder="Search minifigs (e.g. sw0001a or notes)..." value={minifigSearchQuery}
              onChange={(e) => setMinifigSearchQuery(e.target.value)} className="search-input"
            />
            <button className="btn btn-success" onClick={() => handleOpenFigModal()}>+ Add Minifig</button>
          </section>

          {loadingMinifigs ? (
            <div className="loading-spinner">Loading minifigures...</div>
          ) : (
            <div className="table-responsive">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Fig #</th>
                    <th>Name</th>
                    <th>Qty</th>
                    <th>Cond.</th>
                    <th>Cost</th>
                    <th>Market Value</th>
                    <th>Shelf</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMinifigs.map((item) => {
                    const imageUrl = formatImageUrl(item.image_url, item.fig_number, true);
                    const isUsed = item.condition && item.condition.toLowerCase() === 'used';
                    const activeMarketPrice = isUsed ? (item.market_price_used || 0) : (item.market_price_new || 0);

                    return (
                      <tr key={item.id}>
                        <td className="img-cell">
                          {imageUrl ? (
                            <img src={imageUrl} alt={item.fig_name} className="set-thumbnail"
                              onError={(e) => { e.target.onerror = null; e.target.src = 'https://cdn-icons-png.flaticon.com/512/808/808440.png'; }}
                            />
                          ) : <div className="no-img">No Img</div>}
                        </td>
                        <td><strong>{item.fig_number}</strong></td>
                        <td>{item.fig_name}</td>
                        <td>{item.quantity}</td>
                        <td>{item.condition || 'N/A'}</td>
                        <td>${(item.purchase_price || 0).toFixed(2)}</td>
                        <td>${activeMarketPrice.toFixed(2)}</td>
                        <td>{item.shelf_location || '-'}</td>
                        <td>{item.notes || '-'}</td>
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
        <div className="tab-placeholder">
          <h2>⭐ Target Buy List & Wishlist</h2>
          <p>Track desired sets and target deal prices here.</p>
        </div>
      )}

      {/* TAB 4: SALES LOG */}
      {activeTab === 'sales' && (
        <div className="tab-placeholder">
          <h2>💰 Sales & Profit Tracker</h2>
          <p>Log sold items, sale prices, platform fees, and net profit.</p>
        </div>
      )}

      {/* Add / Edit Set Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2>{editingSet ? 'Edit Set' : 'Add New Set'}</h2>
            <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label>Set Number</label>
                <input type="text" required value={formData.set_number} onChange={(e) => setFormData({...formData, set_number: e.target.value})}/>
              </div>
              <div className="form-group">
                <label>Set Name</label>
                <input type="text" required value={formData.set_name} onChange={(e) => setFormData({...formData, set_name: e.target.value})}/>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Quantity</label>
                  <input type="number" min="1" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 1})}/>
                </div>
                <div className="form-group">
                  <label>Condition</label>
                  <select value={formData.condition} onChange={(e) => setFormData({...formData, condition: e.target.value})}>
                    <option value="New">New</option><option value="Used">Used</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Purchase Price ($)</label>
                  <input type="number" step="0.01" value={formData.purchase_price} onChange={(e) => setFormData({...formData, purchase_price: parseFloat(e.target.value) || 0.0})}/>
                </div>
                <div className="form-group">
                  <label>Purchase Date</label>
                  <input type="date" value={formData.purchase_dt} onChange={(e) => setFormData({...formData, purchase_dt: e.target.value})}/>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Store Purchased</label>
                  <input type="text" placeholder="e.g. LEGO Store, Target, eBay" value={formData.store} onChange={(e) => setFormData({...formData, store: e.target.value})}/>
                </div>
                <div className="form-group">
                  <label>Shelf Location</label>
                  <input type="text" value={formData.new_shelf} onChange={(e) => setFormData({...formData, new_shelf: e.target.value})}/>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Polybag?</label>
                  <select value={formData.polybag} onChange={(e) => setFormData({...formData, polybag: e.target.value})}>
                    <option value="No">No</option><option value="Yes">Yes</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Item Notes</label>
                <textarea 
                  rows="2" 
                  placeholder="Damage, box condition, missing parts..." 
                  value={formData.item_notes} 
                  onChange={(e) => setFormData({...formData, item_notes: e.target.value})}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
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
              <div className="form-group">
                <label>Fig Number (e.g. sw0001a)</label>
                <input type="text" required value={figFormData.fig_number} onChange={(e) => setFigFormData({...figFormData, fig_number: e.target.value})}/>
              </div>
              <div className="form-group">
                <label>Minifigure Name</label>
                <input type="text" required value={figFormData.fig_name} onChange={(e) => setFigFormData({...figFormData, fig_name: e.target.value})}/>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Quantity</label>
                  <input type="number" min="1" value={figFormData.quantity} onChange={(e) => setFigFormData({...figFormData, quantity: parseInt(e.target.value) || 1})}/>
                </div>
                <div className="form-group">
                  <label>Condition</label>
                  <select value={figFormData.condition} onChange={(e) => setFigFormData({...figFormData, condition: e.target.value})}>
                    <option value="New">New</option><option value="Used">Used</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Purchase Price ($)</label>
                  <input type="number" step="0.01" value={figFormData.purchase_price} onChange={(e) => setFigFormData({...figFormData, purchase_price: parseFloat(e.target.value) || 0.0})}/>
                </div>
                <div className="form-group">
                  <label>Shelf Location</label>
                  <input type="text" value={figFormData.shelf_location} onChange={(e) => setFigFormData({...figFormData, shelf_location: e.target.value})}/>
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea 
                  rows="2" 
                  placeholder="Minifig condition, accessories, cracked torso..." 
                  value={figFormData.notes} 
                  onChange={(e) => setFigFormData({...figFormData, notes: e.target.value})}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsFigModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Minifigure</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
