import React, { useState, useEffect } from 'react';

function App() {
  const [file, setFile] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

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

  // Portfolio Valuation Metrics
  const totalQuantity = sets.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const totalValueNew = sets.reduce(
    (sum, item) => sum + (item.market_price_new || 0) * (item.quantity || 1),
    0
  );

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '1200px', margin: '0 auto', color: '#1a1a1a' }}>
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
            fontSize: '14px',
          }}
        >
          {syncing ? 'Syncing...' : 'Sync BrickLink Data'}
        </button>
      </header>

      {/* Summary Valuation Cards */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '28px' }}>
        <div style={{ flex: 1, padding: '20px', background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '10px' }}>
          <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Total Collection Items</span>
          <h2 style={{ margin: '8px 0 0 0', fontSize: '32px', color: '#212529' }}>{totalQuantity.toLocaleString()}</h2>
        </div>
        <div style={{ flex: 1, padding: '20px', background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '10px' }}>
          <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Est. Market Value (New)</span>
          <h2 style={{ margin: '8px 0 0 0', fontSize: '32px', color: '#2e7d32' }}>${totalValueNew.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
        </div>
      </div>

      {/* Upload Controls */}
      <div style={{ marginBottom: '32px', padding: '18px', background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '15px' }}>Import / Sync CSV Inventory</h4>
        <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} />
        <button onClick={handleUpload} style={{ marginLeft: '12px', padding: '6px 16px', cursor: 'pointer', fontWeight: '500' }}>
          Upload CSV
        </button>
        {statusMessage && <p style={{ marginTop: '10px', fontSize: '14px', fontWeight: '500', color: '#495057' }}>{statusMessage}</p>}
      </div>

      {/* Primary Collection Table */}
      <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Your Collection ({sets.length.toLocaleString()} Unique Sets)</h2>
      {loading && sets.length === 0 ? (
        <p>Loading library records...</p>
      ) : sets.length === 0 ? (
        <p>No sets found in database.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '12px 10px' }}>Thumbnail</th>
                <th style={{ padding: '12px 10px' }}>Set #</th>
                <th style={{ padding: '12px 10px' }}>Set Name</th>
                <th style={{ padding: '12px 10px' }}>Shelf Location</th>
                <th style={{ padding: '12px 10px' }}>Qty</th>
                <th style={{ padding: '12px 10px' }}>Condition</th>
                <th style={{ padding: '12px 10px' }}>Market Price (New)</th>
              </tr>
            </thead>
            <tbody>
              {sets.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #e9ecef' }}>
                  <td style={{ padding: '8px 10px' }}>
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.set_name} style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ width: '48px', height: '48px', background: '#f1f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#adb5bd', borderRadius: '4px' }}>
                        No Image
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: '600' }}>{item.set_number}</td>
                  <td style={{ padding: '8px 10px' }}>{item.set_name}</td>
                  <td style={{ padding: '8px 10px', color: '#6c757d' }}>{item.new_shelf || 'N/A'}</td>
                  <td style={{ padding: '8px 10px', fontWeight: '500' }}>{item.quantity}</td>
                  <td style={{ padding: '8px 10px' }}>{item.condition || 'N/A'}</td>
                  <td style={{ padding: '8px 10px', color: '#2e7d32', fontWeight: '600' }}>
                    {item.market_price_new ? `$${item.market_price_new.toFixed(2)}` : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;
