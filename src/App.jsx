import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE_URL = "https://lego-inventory-backend.onrender.com";

const formatImageUrl = (url) => {
  if (!url || url === 'null' || url === 'undefined') return null;
  // If URL starts with '//', prepend 'https:'
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  // If URL starts with 'http://', replace with 'https://'
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  return url;
};

function App() {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [filterPolybag, setFilterPolybag] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSet, setEditingSet] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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
    polybag: ''
  });

  const fetchSets = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/sets`);
      if (res.ok) {
        const data = await res.json();
        setSets(data);
      }
    } catch (err) {
      console.error("Failed to fetch sets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSets();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage('Syncing with BrickLink API...');
    try {
      const res = await fetch(`${API_BASE_URL}/sync-bricklink`, { method: 'POST' });
      const data = await res.json();
      setSyncMessage(data.message || 'Sync completed.');
      fetchSets();
    } catch (err) {
      setSyncMessage('Sync failed. Please check backend connection.');
    } finally {
      setSyncing(false);
    }
  };

  const handleCsvExport = () => {
    if (sets.length === 0) return;
    const headers = ["ID", "Set Number", "Set Name", "Shelf", "Qty", "Condition", "Purchase Price", "Purchase Date", "Store", "Notes", "Polybag", "Market New", "Market Used"];
    const rows = sets.map(s => [
      s.id,
      `"${s.set_number || ''}"`,
      `"${s.set_name || ''}"`,
      `"${s.new_shelf || ''}"`,
      s.quantity,
      `"${s.condition || ''}"`,
      s.purchase_price,
      `"${s.purchase_dt || ''}"`,
      `"${s.store || ''}"`,
      `"${s.item_notes || ''}"`,
      `"${s.polybag || ''}"`,
      s.market_price_new,
      s.market_price_used
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `lego_inventory_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this set?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/sets/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchSets();
      }
    } catch (err) {
      console.error("Failed to delete set:", err);
    }
  };

  const handleEditClick = (set) => {
    setEditingSet(set);
    setFormData({
      set_number: set.set_number || '',
      set_name: set.set_name || '',
      quantity: set.quantity || 1,
      condition: set.condition || 'New',
      purchase_price: set.purchase_price || 0.0,
      purchase_dt: set.purchase_dt || '',
      new_shelf: set.new_shelf || '',
      item_notes: set.item_notes || '',
      store: set.store || '',
      polybag: set.polybag || ''
    });
  };

  const handleAddClick = () => {
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
      polybag: ''
    });
    setIsAddModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const endpoint = editingSet ? `${API_BASE_URL}/sets/${editingSet.id}` : `${API_BASE_URL}/add-set`;
    const method = editingSet ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setEditingSet(null);
        setIsAddModalOpen(false);
        fetchSets();
      }
    } catch (err) {
      console.error("Failed to save set:", err);
    }
  };

  const filteredSets = sets.filter(s => {
    const matchesSearch = (s.set_name && s.set_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (s.set_number && s.set_number.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (filterPolybag === 'YES') {
      return matchesSearch && s.polybag && s.polybag.toLowerCase() === 'yes';
    } else if (filterPolybag === 'NO') {
      return matchesSearch && (!s.polybag || s.polybag.toLowerCase() !== 'yes');
    }
    return matchesSearch;
  });

  const totalSetsCount = sets.reduce((sum, s) => sum + (s.quantity || 1), 0);
  const totalCost = sets.reduce((sum, s) => sum + ((s.purchase_price || 0) * (s.quantity || 1)), 0);
  const totalMarketVal = sets.reduce((sum, s) => {
    const price = s.condition === 'Used' ? (s.market_price_used || 0) : (s.market_price_new || 0);
    return sum + (price * (s.quantity || 1));
  }, 0);

  return (
    <div style={{ padding: '15px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0066cc' }}>🧱 LEGO Collection Tracker</h1>
        <div style={{ display: 'flex', gap: '
