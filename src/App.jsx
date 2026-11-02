import React, { useState, useEffect } from 'react';

const API_URL = "https://lego-inventory-backend.vercel.app";

export default function App() {
  const [sets, setSets] = useState([]);
  const [search, setSearch] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [showImporter, setShowImporter] = useState(false);

  const fetchSets = async () => {
    try {
      const res = await fetch(`${API_URL}/sets`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
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
      try {
        const text = event.target.result;
        // Handle Windows (\r\n) and Unix (\n) line breaks
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) {
          alert("CSV file appears empty or missing data rows.");
          return;
        }

        // Auto-detect semicolon vs comma delimiter
        const firstLine = lines[0];
        const delimiter = firstLine.includes(';') ? ';' : ',';

        // Normalize header text
        const rawHeaders = firstLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));

        const parsedSets = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
          if (values.length < 2) continue;

          let row = {};
          rawHeaders.forEach((header, index) => {
            row[header] = values[index] || "";
          });

          // Match exact spreadsheet headers
          const setNum = row["set_number"] || row["set_num"] || row["set #"] || row["number"] || "";
          const setName = row["set_name"] || row["name"] || row["title"] || "";
          const shelf = row["new shelf"] || row["shelf"] || row["location"] || "";
          const purchaseDate = row["purchase_dt"] || row["purchase_date"] || row["date"] || "";
          const purchasePrice = row["purchase_price"] || row["price"] || row["cost"] || "";
          const quantity = parseInt(row["quantity"] || "1", 10) || 1;
          const condition = row["condition"] || "New";
          const notes = row["item notes"] || row["notes"] || row["item_notes"] || "";
          const store = row["store"] || row["retailer"] || "";

          if (setNum || setName) {
            parsedSets.push({
              set_num: setNum || "N/A",
              name: setName || "Unnamed Set",
              shelf: shelf,
              theme: "Unassigned",
              purchase_date: purchaseDate,
              purchase_price: purchasePrice,
              quantity: quantity,
              condition: condition,
              notes: notes,
              store: store
            });
          }
        }

        if (parsedSets.length === 0) {
          alert("Could not extract set data. Please check CSV column headers.");
          return;
        }

        setStatusMsg(`Uploading ${parsedSets.length} sets...`);

        const res = await fetch(`${API_URL}/sets/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsedSets)
        });

        if (res.ok) {
          alert(`Successfully imported ${parsedSets.length} sets!`);
          setStatusMsg(`Successfully imported ${parsedSets.length} sets!`);
          await fetchSets();
          setTimeout(() => {
            setShowImporter(false);
            setStatusMsg("");
          }, 1500);
        } else {
          const errData = await res.json();
          alert(`Import failed: ${errData.detail || 'Server error'}`);
          setStatusMsg("Import failed.");
        }
      } catch (err) {
        console.error("File processing error", err);
        alert(`Error reading file: ${err.message}`);
        setStatusMsg("Error parsing file.");
      }
    };

    reader.readAsText(file);
  };

  const filteredSets = sets.filter(s => 
    (s.name && s.name.toLowerCase().includes(search.toLowerCase())) || 
    (s.set_num && s.set_num.toLowerCase().includes(search.toLowerCase())) ||
    (s.shelf && s.shelf.toLowerCase().includes(search.toLowerCase())) ||
    (s.store && s.store.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#333' }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '1.4em' }}>🧱 LEGO Collection</h2>
        <button 
          onClick={() => setShowImporter(!showImporter)}
          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: '0.85em' }}
        >
          {showImporter ? "Close Import" : "⚙️ Import CSV"}
        </button>
      </div>

      {/* Collapsible Importer Box */}
      {showImporter && (
        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e9ecef' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>Import Sets from CSV</h4>
          <input type="file" accept=".csv" onChange={handleFileUpload} style={{ width: '100%' }} />
          {statusMsg && <p style={{ color: '#0d6efd', marginTop: '10px', fontSize: '0.9em', margin: '10px 0 0 0' }}>{statusMsg}</p>}
        </div>
      )}

      {/* Search Input */}
      <div style={{ marginBottom: '16px' }}>
        <input 
          type="text" 
          placeholder="Search by name, set #, shelf, store..." 
          value={search} 
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '1em', boxSizing: 'border-box' }}
        />
      </div>

      {/* Set Count Header */}
      <div style={{ fontSize: '0.9em', color: '#666', marginBottom: '12px', fontWeight: '600' }}>
        TOTAL SETS: {filteredSets.length}
      </div>

      {/* Collection List */}
      {filteredSets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#888', background: '#f9f9f9', borderRadius: '8px' }}>
          No LEGO sets found in inventory.<br />
          <small>Tap <b>⚙️ Import CSV</b> at the top to select your LegoSpreadsheet.csv file.</small>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredSets.map((item) => (
            <div key={item.id || item.set_num} style={{ background: '#fff', border: '1px solid #e0e0e0', padding: '14px', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.05em', color: '#111' }}>{item.name}</div>
              <div style={{ fontSize: '0.85em', color: '#666', marginTop: '2px' }}>Set #{item.set_num}</div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px', fontSize: '0.8em' }}>
                {item.shelf && <span style={{ background: '#e9ecef', padding: '3px 8px', borderRadius: '4px' }}><b>Shelf:</b> {item.shelf}</span>}
                {item.store && <span style={{ background: '#e9ecef', padding: '3px 8px', borderRadius: '4px' }}><b>Store:</b> {item.store}</span>}
                {item.purchase_price && <span style={{ background: '#e9ecef', padding: '3px 8px', borderRadius: '4px' }}><b>Price:</b> {item.purchase_price}</span>}
                {item.condition && <span style={{ background: '#e9ecef', padding: '3px 8px', borderRadius: '4px' }}><b>Condition:</b> {item.condition}</span>}
              </div>

              {item.notes && (
                <div style={{ fontSize: '0.82em', color: '#555', marginTop: '8px', borderTop: '1px dashed #eee', paddingTop: '6px' }}>
                  <i>Notes: {item.notes}</i>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
