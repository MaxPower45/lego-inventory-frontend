import React, { useState } from 'react';

export default function App() {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("https://lego-inventory-backend.onrender.com/upload-csv", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      alert("Success! " + JSON.stringify(data));
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed. Make sure backend is awake at https://lego-inventory-backend.onrender.com/");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>LEGO Collection Tracker</h1>
      <p>Select your <code>LegoSpreadsheet.csv</code> file to update inventory:</p>
      <input 
        type="file" 
        accept=".csv" 
        onChange={handleFileUpload} 
        disabled={uploading} 
      />
      {uploading && <p>Uploading and processing sets... Please wait.</p>}
    </div>
  );
}
