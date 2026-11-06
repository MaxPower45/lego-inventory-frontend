import React, { useState, useEffect, useMemo } from 'react';

function App() {
  const [file, setFile] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modals & Panels
  const [selectedSet, setSelectedSet] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStats, setShowStats] = useState(false);

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
    store: '',
    polybag: 'No'
  });

  // Search, Filter & Sort Controls
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [selectedStore, setSelectedStore] = useState('All');
  const [selectedShelf, setSelectedShelf] = useState('All');
  const [polybagFilter, setPolybagFilter] = useState('All');
  const [sortBy, setSortBy] = useState('set_number');
  const [sortOrder, setSortOrder] = useState('asc');

  const API_URL = 'https://lego-inventory-backend.onrender.com';

  // Helper to ensure all image URLs use HTTPS to prevent browser blocking
  const formatImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://')) {
      return url.replace('http://', 'https://');
    }
    return url;
  };

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
      'polybag',
      'image_url'
    ];

    const csvRows = [headers.join(',')];

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
        `"${(item.polybag || 'No').replace(/"/g, '""')}"`,
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
          store: '',
          polybag: 'No'
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
          store: selectedSet.store || '',
          polybag: selectedSet.polybag || 'No'
        }),
      });

      if (response.ok) {
        setSelectedSet(null);
        await fetchSets();
      } else {
        alert('Failed to update set details.');
      }
    } catch (err) {
      console.error('Error updating set:', err
