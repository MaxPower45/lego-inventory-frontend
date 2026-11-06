import React, { useState, useEffect, useMemo } from 'react';

function App() {
  const [file, setFile] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modals
  const [selectedSet, setSelectedSet] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Single Set Add Form State
  const [newSetData, setNewSetData] = useState({
    set_number: '',
    set_name: '',
    quantity: 1,
    condition: 'New',
    purchase_price: '',
    purchase_dt: '',
    new_shelf: '',
    item_notes: '',
    store: ''
  });

  // Search, Filter & Sort Controls
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [selectedStore, setSelectedStore] = useState('All');
  const [selectedShelf, setSelectedShelf] = useState('All');
  const [sortBy, setSortBy] = useState('set_number');
  const [sortOrder, setSortOrder] = useState('asc');

  const API_URL = 'https://lego-inventory-backend.onrender.com';

  const fetchSets = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/sets`);
      if (res.ok) {
        const data = await res.json();
        setSets(data);
      }
    } catch (err) {
      console.error('Error fetching sets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSets();
  }, []);

  const handleUpload = async () => {
    if (!file) {
      setStatusMessage('Please select a CSV file first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setStatusMessage('Uploading CSV...');
      const response = await fetch(`${API_URL}/upload-csv`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setStatusMessage('Upload complete! Refreshing collection...');
        await fetchSets();
      } else {
        const errorData = await response.json();
        setStatusMessage(`Upload failed: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (err) {
      setStatusMessage('Error uploading file.');
    }
  };

  // Export Inventory as CSV Backup
  const handleExportCSV = () => {
    if (sets.length === 0) {
      alert('No inventory data available to export.');
      return;
    }

    const headers = [
      'set_number',
      'set_name',
      'quantity',
      'condition',
      'purchase_price',
      'market_price_new',
      'market_price_used',
      'store',
      'new_shelf',
      'purchase_dt',
      'item_notes',
      'image_url'
    ];

    const csvRows = [];
    csvRows.push(headers.join(','));

    sets.forEach(item => {
      const row = [
        `"${(item.set_number || '').replace(/"/g, '""')}"`,
        `"${(item.set_name || '').replace(/"/g, '""')}"`,
        item.quantity || 1,
        `"${(item.condition || '').replace(/"/g, '""')}"`,
        item.purchase_price || 0.0,
        item.market_price_new || 0.0,
        item.market_price_used || 0.0,
        `"${(item.store || '').replace(/"/g, '""')}"`,
        `"${(item.new_shelf || '').replace(/"/g, '""')}"`,
        `"${(item.purchase_dt || '').replace(/"/g, '""')}"`,
        `"${(item.item_notes || '').replace(/"/g, '""')}"`,
        `"${(item.image_url || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `lego_inventory_backup_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    setStatusMessage('Syncing with BrickLink API...');

    try {
      const res = await fetch(`${API_URL}/sync-bricklink?limit=100`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setStatusMessage(`Sync complete: ${data.message}`);
        await fetchSets();
      } else {
        setStatusMessage('Failed to sync with BrickLink.');
      }
    } catch (err) {
      setStatusMessage('Error syncing with BrickLink.');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddSingleSet = async (e) => {
    e.preventDefault();
    if (!newSetData.set_number || !newSetData.set_name) {
      alert('Set Number and Set Name are required.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/add-set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newSetData,
          quantity: parseInt(newSetData.quantity) || 1,
          purchase_price: parseFloat(newSetData.purchase_price) || 0.0
        })
      });

      if (res.ok) {
        setShowAddModal(false);
        setNewSetData({
          set_number: '',
          set_name: '',
          quantity: 1,
          condition: 'New',
          purchase_price: '',
          purchase_dt: '',
          new_shelf: '',
          item_notes: '',
          store: ''
        });
        await fetchSets();
      } else {
        alert('Failed to add new set.');
      }
    } catch (err) {
      console.error('Error adding set:', err);
      alert('Error adding set to database.');
    } finally {
      setSaving(false);
    }
  };

  const handleModalChange = (field, value) => {
    setSelectedSet(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveChanges = async () => {
    if (!selectedSet) return;
    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/sets/${selectedSet.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          set_number: selectedSet.set_number || '',
          set_name: selectedSet.set_name || '',
          quantity: parseInt(selectedSet.quantity) || 1,
          condition: selectedSet.condition || 'New',
          purchase_price: parseFloat(selectedSet.purchase_price) || 0.0,
          purchase_dt: selectedSet.purchase_dt || '',
          new_shelf: selectedSet.new_shelf || '',
          item_notes: selectedSet.item_notes || '',
          store: selectedSet.store || ''
        }),
      });

      if (response.ok) {
        setSelectedSet(null);
        await fetchSets();
      } else {
        alert('Failed to update set details.');
      }
    } catch (err) {
      console.error('Error updating set:', err);
      alert('Error saving set update.');
    } finally {
      setSaving(false);
    }
  };

  // Helper for item market price based on condition
  const getItemMarketPrice = (item) => {
    const isUsed = item.condition && item.condition.toLowerCase() === 'used';
    if (isUsed) {
      return item.market_price_used > 0 ? item.market_price_used : item.market_price_new || 0;
    }
    return item.market_price_new || 0;
  };

  // Extract unique Store and Shelf values for dropdown filters
  const uniqueStores = useMemo(() => {
    const stores = sets.map(s => s.store).filter(Boolean);
    return ['All', ...Array.from(new Set(stores)).sort()];
  }, [sets]);

  const uniqueShelves = useMemo(() => {
    const shelves = sets.map(s => s.new_shelf).filter(Boolean);
    return ['All', ...Array.from(new Set(shelves)).sort()];
  }, [sets]);

  // Filter & Sort Logic
  const filteredAndSortedSets = useMemo(() => {
    return sets.filter(item => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        (item.set_number && item.set_number.toLowerCase().includes(searchLower)) ||
        (item.set_name && item.set_name.toLowerCase().includes(searchLower)) ||
        (item.item_notes && item.item_notes.toLowerCase().includes(searchLower));

      const matchesCondition = selectedCondition === 'All' || 
        (item.condition && item.condition.toLowerCase() === selectedCondition.toLowerCase());

      const matchesStore = selectedStore === 'All' || item.store === selectedStore;
      const matchesShelf = selectedShelf === 'All' || item.new_shelf === selectedShelf;

      return matchesSearch && matchesCondition && matchesStore && matchesShelf;
    }).sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (sortBy === 'market_price') {
        aVal = getItemMarketPrice(a);
        bVal = getItemMarketPrice(b);
      }

      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal, undefined, { numeric: true }) 
          : bVal.localeCompare(aVal, undefined, { numeric: true });
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [sets, searchTerm, selectedCondition, selectedStore, selectedShelf, sortBy, sortOrder]);

  const totalQuantity = filteredAndSortedSets.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const totalPurchaseCost = filteredAndSortedSets.reduce((sum, item) => sum + ((item.purchase_price || 0) * (item.quantity || 1)), 0);
  const totalMarketValuation = filteredAndSortedSets.reduce((sum, item) => sum + (getItemMarketPrice(item) * (item.quantity || 1)), 0);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCondition('All');
    setSelectedStore('All');
    setSelectedShelf('All');
    setSortBy('set_number');
    setSortOrder('asc');
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '1400px', margin: '0 auto', color: '#1a1a1a' }}>
      
      {/* App Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '700' }}>LEGO Collection Tracker</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '10px 18px',
              backgroundColor: '#2e7d32',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            + Add Single Set
          </button>
          <button
            onClick={handleSyncAll}
            disabled={syncing}
            style={{
              padding: '10px 18px',
              backgroundColor: syncing ? '#888' : '#0066cc',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: syncing ? 'not-allowed' : 'pointer',
              fontWeight: '600',
            }}
          >
            {syncing ? 'Syncing...' : 'Sync BrickLink Data'}
          </button>
        </div>
      </header>

      {/* Summary Valuation Cards */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '28px' }}>
        <div style={{ flex: 1, padding: '20px', background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '10px' }}>
          <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Filtered Quantity</span>
          <h2 style={{ margin: '8px 0 0 0', fontSize: '30px', color: '#212529' }}>{totalQuantity.toLocaleString()} Sets</h2>
        </div>
        <div style={{ flex: 1, padding: '20px', background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '10px' }}>
          <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Filtered Purchase Cost</span>
          <h2 style={{ margin: '8px 0 0 0', fontSize: '30px', color: '#495057' }}>${totalPurchaseCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
        </div>
        <div style={{ flex: 1, padding: '20px', background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '10px' }}>
          <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Filtered Est. Market Value</span>
          <h2 style={{ margin: '8px 0 0 0', fontSize: '30px', color: '#2e7d32' }}>${totalMarketValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
        </div>
      </div>

      {/* CSV Import & Export Backup Bar */}
      <div style={{ marginBottom: '24px', padding: '16px', background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '15px' }}>Import Inventory CSV</h4>
          <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} />
          <button onClick={handleUpload} style={{ marginLeft: '12px', padding: '6px 16px', cursor: 'pointer' }}>
            Upload CSV
          </button>
        </div>
        <div>
          <button 
            onClick={handleExportCSV}
            style={{
              padding: '9px 16px',
              backgroundColor: '#495057',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px'
            }}
          >
            ⬇ Export CSV Backup
          </button>
        </div>
      </div>

      {statusMessage && <p style={{ marginTop: '-14px', marginBottom: '20px', fontSize: '14px', fontWeight: '500', color: '#495057' }}>{statusMessage}</p>}

      {/* Power Toolbar: Search, Filters & Sorting Controls */}
      <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '10px', border: '1px solid #dee2e6', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
        <div style={{ flex: '2 1 240px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#495057', marginBottom: '4px' }}>Search Sets</label>
          <input
            type="text"
            placeholder="Search by name, #, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '14px' }}
          />
        </div>

        <div style={{ flex: '1 1 130px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#495057', marginBottom: '4px' }}>Condition</label>
          <select value={selectedCondition} onChange={(e) => setSelectedCondition(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '14px' }}>
            <option value="All">All Conditions</option>
            <option value="New">New</option>
            <option value="Used">Used</option>
          </select>
        </div>

        <div style={{ flex: '1 1 150px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#495057', marginBottom: '4px' }}>Store</label>
          <select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '14px' }}>
            {uniqueStores.map(store => (
              <option key={store} value={store}>{store === 'All' ? 'All Stores' : store}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1 1 130px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#495057', marginBottom: '4px' }}>Shelf Location</label>
          <select value={selectedShelf} onChange={(e) => setSelectedShelf(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '14px' }}>
            {uniqueShelves.map(shelf => (
              <option key={shelf} value={shelf}>{shelf === 'All' ? 'All Shelves' : shelf}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1 1 150px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#495057', marginBottom: '4px' }}>Sort By</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ced4da', fontSize: '14px' }}>
            <option value="set_number">Set #</option>
            <option value="set_name">Set Name</option>
            <option value="purchase_price">Paid Price</option>
            <option value="market_price">Market Value</option>
            <option value="quantity">Quantity</option>
            <option value="purchase_dt">Purchase Date</option>
          </select>
        </div>

        <div style={{ flex: '0 0 auto' }}>
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #ced4da', backgroundColor: '#fff', cursor: 'pointer', fontWeight: '600' }}
          >
            {sortOrder === 'asc' ? '⬆ Asc' : '⬇ Desc'}
          </button>
        </div>

        <div style={{ flex: '0 0 auto' }}>
          <button
            onClick={resetFilters}
            style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #dc3545', backgroundColor: '#fff', color: '#dc3545', cursor: 'pointer', fontWeight: '600' }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Primary Collection Table */}
      <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>
        Showing {filteredAndSortedSets.length.toLocaleString()} of {sets.length.toLocaleString()} Sets — <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#666' }}>Click any row to edit details</span>
      </h2>
      
      {loading && sets.length === 0 ? (
        <p>Loading library records...</p>
      ) : filteredAndSortedSets.length === 0 ? (
        <p style={{ padding: '20px', background: '#f8f9fa', borderRadius: '8px', color: '#6c757d' }}>No sets match your current search and filter selections.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '12px 10px' }}>Img</th>
                <th style={{ padding: '12px 10px' }}>Set #</th>
                <th style={{ padding: '12px 10px' }}>Set Name</th>
                <th style={{ padding: '12px 10px' }}>Shelf</th>
                <th style={{ padding: '12px 10px' }}>Qty</th>
                <th style={{ padding: '12px 10px' }}>Condition</th>
                <th style={{ padding: '12px 10px' }}>Paid</th>
                <th style={{ padding: '12px 10px' }}>Market Price</th>
                <th style={{ padding: '12px 10px' }}>Store</th>
                <th style={{ padding: '12px 10px' }}>Purchased</th>
                <th style={{ padding: '12px 10px' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedSets.map((item) => {
                const mktPrice = getItemMarketPrice(item);
                return (
                  <tr 
                    key={item.id} 
                    onClick={() => setSelectedSet({ ...item })}
                    style={{ borderBottom: '1px solid #e9ecef', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f3f5'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '8px 10px' }}>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.set_name} style={{ width: '44px', height: '44px', objectFit: 'contain' }} />
                      ) : (
                        <div style={{ width: '44px', height: '44px', background: '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#adb5bd', borderRadius: '4px' }}>
                          No Img
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: '600' }}>{item.set_number}</td>
                    <td style={{ padding: '8px 10px' }}>{item.set_name}</td>
                    <td style={{ padding: '8px 10px', color: '#6c757d' }}>{item.new_shelf || '-'}</td>
                    <td style={{ padding: '8px 10px', fontWeight: '500' }}>{item.quantity}</td>
                    <td style={{ padding: '8px 10px' }}>{item.condition || '-'}</td>
                    <td style={{ padding: '8px 10px' }}>{item.purchase_price > 0 ? `$${item.purchase_price.toFixed(2)}` : '-'}</td>
                    <td style={{ padding: '8px 10px', color: '#2e7d32', fontWeight: '600' }}>
                      {mktPrice > 0 ? `$${mktPrice.toFixed(2)}` : 'N/A'}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#495057' }}>{item.store || '-'}</td>
                    <td style={{ padding: '8px 10px', color: '#6c757d' }}>{item.purchase_dt || '-'}</td>
                    <td style={{ padding: '8px 10px', color: '#6c757d', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.item_notes || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Add Single Set */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '28px', borderRadius: '12px', maxWidth: '550px', width: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '20px' }}>Add Single Set</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#888' }}>✕</button>
            </div>

            <form onSubmit={handleAddSingleSet} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>Set # *</label>
                  <input type="text" required value={newSetData.set_number} onChange={(e) => setNewSetData({...newSetData, set_number: e.target.value})} placeholder="e.g. 75313" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>Set Name *</label>
                  <input type="text" required value={newSetData.set_name} onChange={(e) => setNewSetData({...newSetData, set_name: e.target.value})} placeholder="e.g. AT-AT" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>Quantity</label>
                  <input type="number" min="1" value={newSetData.quantity} onChange={(e) => setNewSetData({...newSetData, quantity: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>Condition</label>
                  <select value={newSetData.condition} onChange={(e) => setNewSetData({...newSetData, condition: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                    <option value="New">New</option>
                    <option value="Used">Used</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>Purchase Price ($)</label>
                  <input type="number" step="0.01" value={newSetData.purchase_price} onChange={(e) => setNewSetData({...newSetData, purchase_price: e.target.value})} placeholder="0.00" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>Purchase Date</label>
                  <input type="text" value={newSetData.purchase_dt} onChange={(e) => setNewSetData({...newSetData, purchase_dt: e.target.value})} placeholder="MM/DD/YYYY" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>Shelf Location</label>
                  <input type="text" value={newSetData.new_shelf} onChange={(e) => setNewSetData({...newSetData, new_shelf: e.target.value})} placeholder="e.g. 0049" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>Store</label>
                  <input type="text" value={newSetData.store} onChange={(e) => setNewSetData({...newSetData, store: e.target.value})} placeholder="e.g. LEGO Store" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>Notes</label>
                <textarea rows="2" value={newSetData.item_notes} onChange={(e) => setNewSetData({...newSetData, item_notes: e.target.value})} placeholder="Item condition notes..." style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button type="submit" disabled={saving} style={{ flex: 1, padding: '10px', backgroundColor: saving ? '#888' : '#2e7d32', color: '#fff', border: 'none', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                  {saving ? 'Adding...' : 'Add Set to Collection'}
                </button>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '10px', backgroundColor: '#e9ecef', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Set Record */}
      {selectedSet && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '28px', borderRadius: '12px', maxWidth: '550px', width: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px' }}>Edit Set Record</h3>
                <p style={{ margin: '4px 0 0 0', color: '#666', fontWeight: 'bold' }}>Set #{selectedSet.set_number}</p>
              </div>
              <button onClick={() => setSelectedSet(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#888' }}>✕</button>
            </div>

            {selectedSet.image_url && (
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <img src={selectedSet.image_url} alt={selectedSet.set_name} style={{ maxHeight: '140px', objectFit: 'contain' }} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>Set Name</label>
                <input type="text" value={selectedSet.set_name || ''} onChange={(e) => handleModalChange('set_name', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>Quantity</label>
                  <input type="number" value={selectedSet.quantity || 1} onChange={(e) => handleModalChange('quantity', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>Condition</label>
                  <select value={selectedSet.condition || 'New'} onChange={(e) => handleModalChange('condition', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                    <option value="New">New</option>
                    <option value="Used">Used</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>Purchase Price ($)</label>
                  <input type="number" step="0.01" value={selectedSet.purchase_price || ''} onChange={(e) => handleModalChange('purchase_price', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>Purchase Date</label>
                  <input type="text" value={selectedSet.purchase_dt || ''} onChange={(e) => handleModalChange('purchase_dt', e.target.value)} placeholder="MM/DD/YYYY" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>Shelf Location</label>
                  <input type="text" value={selectedSet.new_shelf || ''} onChange={(e) => handleModalChange('new_shelf', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>Store</label>
                  <input type="text" value={selectedSet.store || ''} onChange={(e) => handleModalChange('store', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>Notes</label>
                <textarea rows="3" value={selectedSet.item_notes || ''} onChange={(e) => handleModalChange('item_notes', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button 
                onClick={handleSaveChanges} 
                disabled={saving}
                style={{ flex: 1, padding: '10px', backgroundColor: saving ? '#888' : '#2e7d32', color: '#fff', border: 'none', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button 
                onClick={() => setSelectedSet(null)} 
                style={{ flex: 1, padding: '10px', backgroundColor: '#e9ecef', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
