import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE = "https://lego-inventory-backend.onrender.com";

const formatImageUrl = (url, setNumber) => {
  if (setNumber && setNumber !== 'N/A') {
    const cleanNum = setNumber.split('-')[0].trim();
    return `https://images.brickset.com/sets/images/${cleanNum}-1.jpg`;
  }
  if (url && url.startsWith('//')) return `https:${url}`;
  if (url && url.startsWith('http://')) return url.replace('http://', 'https://');
  return url;
};

function App() {
  const [activeTab, setActiveTab] = useState('sets'); // 'sets', 'minifigs', 'wishlist', 'sales'
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('');
  const [filterPolybag, setFilterPolybag] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State for Add / Edit Sets
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSet, setEditingSet] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    set_number: '',
    set_name: '',
    quantity: 1,
    condition: 'New',
    purchase_price: 0.0,
    purchase_dt: '',
    new_shelf: '',
    item_notes: '',
    store: '',
    polybag: 'No'
  });

  const fetchSets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sets`);
      if (res.ok) {
        const data = await res.json();
        setSets(data);
      }
    } catch (err) {
      console.error("Error fetching sets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSets();
  }, []);

  const handleSync = async () => {
    setSyncStatus('Syncing with BrickLink API...');
    try {
      const res = await fetch(`${API_BASE}/sync-bricklink`, { method: 'POST' });
      const data = await res.json();
      setSyncStatus(data.message || 'Sync completed.');
      fetchSets();
    } catch (err) {
      setSyncStatus('Error syncing with BrickLink.');
    }
  };

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
        set_number: '',
        set_name: '',
        quantity: 1,
        condition: 'New',
        purchase_price: 0.0,
        purchase_dt: '',
        new_shelf: '',
        item_notes: '',
        store: '',
        polybag: 'No'
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSet(null);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const endpoint = editingSet 
      ? `${API_BASE}/sets/${editingSet.id}` 
      : `${API_BASE}/add-set`;
    
    const method = editingSet ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        handleCloseModal();
        fetchSets();
      } else {
        alert("Failed to save set.");
      }
    } catch (err) {
      console.error("Error saving set:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this set?")) return;
    try {
      const res = await fetch(`${API_BASE}/sets/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchSets();
      }
    } catch (err) {
      console.error("Error deleting set:", err);
    }
  };

  const exportCSV = () => {
    if (!sets.length) return;
    const headers = ["Set Number", "Set Name", "Quantity", "Condition", "Purchase Price", "Shelf", "Polybag"];
    const rows = sets.map(s => [
      `"${s.set_number}"`,
      `"${s.set_name}"`,
      s.quantity,
      `"${s.condition || ''}"`,
      s.purchase_price,
      `"${s.new_shelf || ''}"`,
      `"${s.polybag || ''}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `lego_inventory_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter Logic
  const filteredSets = sets.filter(s => {
    const matchesSearch = s.set_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.set_number?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterPolybag === 'YES') return matchesSearch && (s.polybag?.toLowerCase() === 'yes' || s.polybag?.toLowerCase() === 'true');
    if (filterPolybag === 'NO') return matchesSearch && (!s.polybag || s.polybag?.toLowerCase() === 'no' || s.polybag?.toLowerCase() === 'false');
    return matchesSearch;
  });

  // Financial Stats
  const totalSets = filteredSets.reduce((acc, s) => acc + (s.quantity || 1), 0);
  const totalCost = filteredSets.reduce((acc, s) => acc + ((s.purchase_price || 0) * (s.quantity || 1)), 0);
  const totalMarketNew = filteredSets.reduce((acc, s) => acc + ((s.market_price_new || 0) * (s.quantity || 1)), 0);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🧱 LEGO Collection Tracker</h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleSync}>Sync BrickLink Data</button>
          <button className="btn btn-secondary" onClick={exportCSV}>Export CSV</button>
        </div>
      </header>

      {/* Navigation Tab Bar */}
      <nav className="tab-bar">
        <button 
          className={`tab-btn ${activeTab === 'sets' ? 'active' : ''}`} 
          onClick={() => setActiveTab('sets')}
        >
          📦 Sets ({sets.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'minifigs' ? 'active' : ''}`} 
          onClick={() => setActiveTab('minifigs')}
        >
          🦸 Minifigures
        </button>
        <button 
          className={`tab-btn ${activeTab === 'wishlist' ? 'active' : ''}`} 
          onClick={() => setActiveTab('wishlist')}
        >
          ⭐ Wishlist
        </button>
        <button 
          className={`tab-btn ${activeTab === 'sales' ? 'active' : ''}`} 
          onClick={() => setActiveTab('sales')}
        >
          💰 Sales Log
        </button>
      </nav>

      {syncStatus && <div className="sync-banner">{syncStatus}</div>}

      {/* TAB 1: SETS INVENTORY */}
      {activeTab === 'sets' && (
        <>
          <section className="stats-row">
            <div className="stat-card">
              <h3>Total Items</h3>
              <p>{totalSets}</p>
            </div>
            <div className="stat-card">
              <h3>Total Investment</h3>
              <p>${totalCost.toFixed(2)}</p>
            </div>
            <div className="stat-card">
              <h3>Market Value (New)</h3>
              <p>${totalMarketNew.toFixed(2)}</p>
            </div>
          </section>

          <section className="controls-row">
            <input 
              type="text" 
              placeholder="Search by name or set number..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
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

          {loading ? (
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
                    <th>Market (New)</th>
                    <th>Shelf</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSets.map((item) => {
                    const imageUrl = formatImageUrl(item.image_url, item.set_number);
                    return (
                      <tr key={item.id}>
                        <td className="img-cell">
                          {imageUrl ? (
                            <img 
                              src={imageUrl} 
                              alt={item.set_name} 
                              className="set-thumbnail"
                              onError={(e) => {
                                e.target.onerror = null; 
                                e.target.src = 'https://cdn-icons-png.flaticon.com/512/808/808440.png';
                              }}
                            />
                          ) : (
                            <div className="no-img">No Img</div>
                          )}
                        </td>
                        <td><strong>{item.set_number}</strong></td>
                        <td>{item.set_name}</td>
                        <td>{item.quantity}</td>
                        <td>{item.condition || 'N/A'}</td>
                        <td>${(item.purchase_price || 0).toFixed(2)}</td>
                        <td>${(item.market_price_new || 0).toFixed(2)}</td>
                        <td>{item.new_shelf || '-'}</td>
                        <td className="actions-cell">
                          <button className="btn-icon" onClick={() => handleOpenModal(item)}>✏️</button>
                          <button className="btn-icon text-danger" onClick={() => handleDelete(item.id)}>🗑️</button>
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
        <div className="tab-placeholder">
          <h2>🦸 Minifigures Tracker</h2>
          <p>Database model & table interface coming next!</p>
        </div>
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

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2>{editingSet ? 'Edit Set' : 'Add New Set'}</h2>
            <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label>Set Number</label>
                <input 
                  type="text" 
                  required 
                  value={formData.set_number}
                  onChange={(e) => setFormData({...formData, set_number: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Set Name</label>
                <input 
                  type="text" 
                  required 
                  value={formData.set_name}
                  onChange={(e) => setFormData({...formData, set_name: e.target.value})}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Quantity</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 1})}
                  />
                </div>
                <div className="form-group">
                  <label>Purchase Price ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({...formData, purchase_price: parseFloat(e.target.value) || 0.0})}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Shelf Location</label>
                  <input 
                    type="text" 
                    value={formData.new_shelf}
                    onChange={(e) => setFormData({...formData, new_shelf: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Polybag?</label>
                  <select 
                    value={formData.polybag} 
                    onChange={(e) => setFormData({...formData, polybag: e.target.value})}
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Set</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
