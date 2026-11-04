import React, { useState, useEffect } from 'react';

function App() {
  const [file, setFile] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(false);

  const API_URL = 'https://lego-inventory-backend.onrender.com';

  // Fetch all sets from the backend
  const fetchSets = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/sets`);
      if (res.ok) {
        const data = await res.json();
        setSets(data);
      } else {
        console.error('Failed to fetch sets');
      }
    } catch (err) {
      console.error('Error fetching sets:', err);
    } finally {
      setLoading(false);
    }
  };

  // Automatically load existing inventory on page load
  useEffect(() => {
    fetchSets();
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setStatusMessage('Please select a CSV file first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setStatusMessage('Uploading...');
      const response = await fetch(`${API_URL}/upload-csv`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setStatusMessage('Upload successful! Reloading collection...');
        await fetchSets(); // Refresh the list automatically
      } else {
        const errorData = await response.json();
        setStatusMessage(`Upload failed: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      setStatusMessage('Error uploading file. Check network connection.');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>LEGO Collection Tracker</h1>

      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h3>Upload CSV Inventory</h3>
        <input type="file" accept=".csv" onChange={handleFileChange} />
        <button onClick={handleUpload} style={{ marginLeft: '10px', padding: '6px 12px', cursor: 'pointer' }}>
          Upload
        </button>
        {statusMessage && <p style={{ marginTop: '10px', fontWeight: 'bold' }}>{statusMessage}</p>}
      </div>

      <h2>Your Inventory ({sets.length} items)</h2>
      {loading ? (
        <p>Loading sets...</p>
      ) : sets.length === 0 ? (
        <p>No sets found in database.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f2f2f2', borderBottom: '2px solid #ccc' }}>
                <th style={{ padding: '8px' }}>Set #</th>
                <th style={{ padding: '8px' }}>Set Name</th>
                <th style={{ padding: '8px' }}>Shelf</th>
                <th style={{ padding: '8px' }}>Qty</th>
                <th style={{ padding: '8px' }}>Condition</th>
              </tr>
            </thead>
            <tbody>
              {sets.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '8px' }}>{item.set_number}</td>
                  <td style={{ padding: '8px' }}>{item.set_name}</td>
                  <td style={{ padding: '8px' }}>{item.new_shelf || 'N/A'}</td>
                  <td style={{ padding: '8px' }}>{item.quantity}</td>
                  <td style={{ padding: '8px' }}>{item.condition || 'N/A'}</td>
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
