import React, { useState, useEffect } from 'react';

function App() {
  const [file, setFile] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedSet, setSelectedSet] = useState(null);

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

  // Helper for item market price based on condition
  const getItemMarketPrice = (item) => {
    const isUsed = item.condition && item.condition.toLowerCase() === 'used';
    if (isUsed) {
      return item.market_price_used > 0 ? item.market_price_used : item.market_price_new || 0;
    }
    return item.market_price_new || 0;
  };

  // Portfolio Valuation Metrics
  const totalQuantity = sets.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const totalPurchaseCost = sets.reduce((sum, item) => sum + ((item.purchase_price || 0) * (item.quantity || 1)), 0);
  const totalMarketValuation = sets.reduce((sum, item) => sum + (getItemMarketPrice(item) * (item.quantity || 1)), 0);

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '1400px', margin: '0 auto', color: '#1a1a1a' }}>
      
      {/* App Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '700' }}>LEGO Collection Tracker</h1>
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
      </header>

      {/* Summary Valuation Cards */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '28px' }}>
        <div style={{ flex: 1, padding: '20px', background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '10px' }}>
          <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Total Quantity</span>
          <h2 style={{ margin: '8px 0 0 0', fontSize: '30px', color: '#212529' }}>{totalQuantity.toLocaleString()} Sets</h2>
        </div>
        <div style={{ flex: 1, padding: '20px', background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '10px' }}>
          <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Total Purchase Cost</span>
          <h2 style={{ margin: '8px 0 0 0', fontSize: '30px', color: '#495057' }}>${totalPurchaseCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
        </div>
        <div style={{ flex: 1, padding: '20px', background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '10px' }}>
          <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Est. Market Valuation</span>
          <h2 style={{ margin: '8px 0 0 0', fontSize: '30px', color: '#2e7d32' }}>${totalMarketValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
        </div>
      </div>

      {/* CSV Upload Controls */}
      <div style={{ marginBottom: '24px', padding: '16px', background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: '10px' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '15px' }}>Import Inventory CSV</h4>
        <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} />
        <button onClick={handleUpload} style={{ marginLeft: '12px', padding: '6px 16px', cursor: 'pointer' }}>
          Upload CSV
        </button>
        {statusMessage && <p style={{ marginTop: '10px', fontSize: '14px', fontWeight: '500', color: '#495057' }}>{statusMessage}</p>}
      </div>

      {/* Primary Collection Table */}
      <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>
        Your Inventory ({sets.length.toLocaleString()} Unique Lines) — <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#666' }}>Click any row to view full details</span>
      </h2>
      
      {loading && sets.length === 0 ? (
        <p>Loading library records...</p>
      ) : sets.length === 0 ? (
        <p>No sets found in database.</p>
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
              {sets.map((item) => {
                const mktPrice = getItemMarketPrice(item);
                return (
                  <tr 
                    key={item.id} 
                    onClick={() => setSelectedSet(item)}
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
                    <td style={{ padding: '8px 10px', color: '#6c757d' }}>{item.new_shelf || 'N/A'}</td>
                    <td style={{ padding: '8px 10px', fontWeight: '500' }}>{item.quantity}</td>
                    <td style={{ padding: '8px 10px' }}>{item.condition || 'N/A'}</td>
                    <td style={{ padding: '8px 10px' }}>{item.purchase_price > 0 ? `$${item.purchase_price.toFixed(2)}` : 'N/A'}</td>
                    <td style={{ padding: '8px 10px', color: '#2e7d32', fontWeight: '600' }}>
                      {mktPrice > 0 ? `$${mktPrice.toFixed(2)}` : 'N/A'}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#495057' }}>{item.store || '-'}</td>
                    <td style={{ padding: '8px 10px', color: '#6c757d' }}>{item.purchase_dt || 'N/A'}</td>
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

      {/* Detail Modal */}
      {selectedSet && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '28px', borderRadius: '12px', maxWidth: '550px', width: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px' }}>{selectedSet.set_name}</h3>
                <p style={{ margin: '4px 0 0 0', color: '#666', fontWeight: 'bold' }}>Set #{selectedSet.set_number}</p>
              </div>
              <button onClick={() => setSelectedSet(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#888' }}>✕</button>
            </div>

            {selectedSet.image_url && (
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <img src={selectedSet.image_url} alt={selectedSet.set_name} style={{ maxHeight: '180px', objectFit: 'contain' }} />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8f9fa', padding: '16px', borderRadius: '8px', fontSize: '14px' }}>
              <div><strong>Condition:</strong> {selectedSet.condition || 'N/A'}</div>
              <div><strong>Quantity:</strong> {selectedSet.quantity}</div>
              <div><strong>Shelf Location:</strong> {selectedSet.new_shelf || 'N/A'}</div>
              <div><strong>Store:</strong> {selectedSet.store || 'N/A'}</div>
              <div><strong>Purchase Price:</strong> {selectedSet.purchase_price > 0 ? `$${selectedSet.purchase_price.toFixed(2)}` : 'N/A'}</div>
              <div><strong>Purchase Date:</strong> {selectedSet.purchase_dt || 'N/A'}</div>
              <div><strong>Market Price (New):</strong> {selectedSet.market_price_new > 0 ? `$${selectedSet.market_price_new.toFixed(2)}` : 'N/A'}</div>
              <div><strong>Market Price (Used):</strong> {selectedSet.market_price_used > 0 ? `$${selectedSet.market_price_used.toFixed(2)}` : 'N/A'}</div>
            </div>

            {selectedSet.item_notes && (
              <div style={{ marginTop: '16px', padding: '12px', background: '#fff9db', border: '1px solid #ffe066', borderRadius: '6px', fontSize: '13px' }}>
                <strong>Notes:</strong> {selectedSet.item_notes}
              </div>
            )}

            <button 
              onClick={() => setSelectedSet(null)} 
              style={{ marginTop: '20px', width: '100%', padding: '10px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
