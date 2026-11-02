import React, { useState, useEffect } from 'react';

const API_URL = "https://lego-inventory-backend.vercel.app"; // Your backend URL

export default function App() {
  const [sets, setSets] = useState([]);
  const [search, setSearch] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const fetchSets = async () => {
    try {
      const res = await fetch(`${API_URL}/sets`);
      const data = await res.json();
      setSets(data);
    } catch (err) {
      console.error("Failed to fetch sets", err);
    }
  };

  useEffect(() => {
    fetchSets();
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split('\n').filter(line => line.trim() !== '');
      if (lines.length < 2) return;

      // Semicolon delimited header parsing
      const headers = lines[0].split(';').map(h => h.trim().toLowerCase());
      
      const parsedSets = lines.slice(1).map(line => {
        const values = line.split(';').map(v => v.trim());
        let row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || "";
        });

        return {
          set_num: row["set_number"] || row["set_num"] || "Unknown",
          name: row["set_name"] || row["name"] || "Untitled Set",
          shelf: row["new shelf"] || row["shelf"] || "",
          theme: "Unassigned",
          purchase_date: row["purchase_dt"] || "",
          purchase_price: row["purchase_price"] || "",
          quantity: parseInt(row["quantity"]) || 1,
          condition: row["condition"] || "New",
          notes: row["item notes"] || "",
          store: row["store"] || ""
        };
      });

      setStatusMsg(`Uploading ${parsedSets.length} sets...`);

      try {
        const res = await fetch(`${API_URL}/sets/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsedSets)
        });
        if (res.ok) {
          setStatusMsg("Import Successful!");
          fetchSets();
        } else {
          setStatusMsg("Import Failed.");
        }
      } catch (err) {
        setStatusMsg("Error connecting to server.");
      }
    };

    reader.readAsText(file);
  };

  const filteredSets = sets.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.set_num.toLowerCase().includes(search.toLowerCase()) ||
    (s.shelf && s.shelf.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center' }}>LEGO Collection Tracker</h2>
      
      {/* CSV Import Box */}
      <div style={{ background: '#f4f4f4', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center' }}>
        <h3>Bulk Import Collection</h3>
        <input type="file" accept=".csv" onChange={handleFileUpload} />
        {statusMsg && <p style={{ color: 'blue', marginTop: '10px' }}>{statusMsg}</p>}
      </div>

      {/* Collection Search */}
      <div style={{ marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder="Search by set name, number, or shelf..." 
          value={search} 
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
        />
      </div>

      {/* Collection List */}
      <h3>Collection ({filteredSets.length})</h3>
      {filteredSets.length === 0 ? (
        <p>No LEGO sets found in inventory.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredSets.map((item) => (
            <div key={item.id} style={{ border: '1px solid #ddd', padding: '12px', borderRadius: '6px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{item.name} (#{item.set_num})</div>
              <div style={{ color: '#555', fontSize: '0.9em', marginTop: '4px' }}>
                {item.shelf && <span><b>Shelf:</b> {item.shelf} | </span>}
                {item.store && <span><b>Store:</b> {item.store} | </span>}
                {item.purchase_price && <span><b>Price:</b> {item.purchase_price} | </span>}
                {item.condition && <span><b>Condition:</b> {item.condition}</span>}
              </div>
              {item.notes && <div style={{ fontSize: '0.85em', color: '#777', marginTop: '4px' }}><i>Notes: {item.notes}</i></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
