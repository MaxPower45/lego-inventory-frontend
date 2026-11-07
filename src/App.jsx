import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE = "https://lego-inventory-backend.onrender.com";

const formatImageUrl = (url, itemNumber, isMinifig = false) => {
  if (itemNumber && itemNumber !== 'N/A' && itemNumber !== 'Unknown') {
    if (isMinifig) {
      return `https://images.brickset.com/minifigs/large/${itemNumber}.jpg`;
    }
    const cleanNum = itemNumber.split('-')[0].trim();
    return `https://images.brickset.com/sets/images/${cleanNum}-1.jpg`;
  }
  if (url && url.startsWith('//')) return `https:${url}`;
  if (url && url.startsWith('http://')) return url.replace('http://', 'https://');
  return url;
};

function App() {
  const [activeTab, setActiveTab] = useState('sets'); // 'sets', 'minifigs', 'wishlist', 'sales'
  
  // Sets State
  const [sets, setSets] = useState([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [filterPolybag, setFilterPolybag] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Minifigs State
  const [minifigs, setMinifigs] = useState([]);
  const [loadingMinifigs, setLoadingMinifigs] = useState(false);
  const [minifigSearchQuery, setMinifigSearchQuery] = useState('');

  // Wishlist State
  const [wishlist, setWishlist] = useState([]);
  const [loadingWishlist, setLoadingWishlist] = useState(false);
  const [wishlistSearchQuery, setWishlistSearchQuery] = useState('');

  // Global Sync Status
  const [syncStatus, setSyncStatus] = useState('');

  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSet, setEditingSet] = useState(null);
  const [formData, setFormData] = useState({
    set_number: '', set_name: '', quantity: 1, condition: 'New',
    purchase_price: 0.0, purchase_dt: '', new_shelf: '', item_notes: '', store: '', polybag: 'No'
  });

  const [isFigModalOpen, setIsFigModalOpen] = useState(false);
  const [editingFig, setEditingFig] = useState(null);
  const [figFormData, setFigFormData] = useState({
    fig_number: '', fig_name: '', quantity: 1, condition: 'New',
    purchase_price: 0.0, shelf_location: '', notes: ''
  });

  const [isWishModalOpen, setIsWishModalOpen] = useState(false);
  const [editingWish, setEditingWish] = useState(null);
  const [wishFormData, setWishFormData] = useState({
    item_number: '', item_name: '', item_type: 'SET', target_price: 0.0, priority: 'Medium', notes: ''
  });

  // Fetch Operations
  const fetchSets = async () => {
    setLoadingSets(true);
    try {
      const res = await fetch(`${API_BASE}/sets`);
      if (res.ok) setSets(await res.json());
    } catch (err) { console.error(err); } finally { setLoadingSets(false); }
  };

  const fetchMinifigs = async () => {
    setLoadingMinifigs(true);
    try {
      const res = await fetch(`${API_BASE}/minifigs`);
      if (res.ok) setMinifigs(await res.json());
    } catch (err) { console.error(err); } finally { setLoadingMinifigs(false); }
  };

  const fetchWishlist = async () => {
    setLoadingWishlist(true);
    try {
      const res = await fetch(`${API_BASE}/wishlist`);
      if (res.ok) setWishlist(await res.json());
    } catch (err) { console.error(err); } finally { setLoadingWishlist(false); }
  };

  useEffect(() => {
    fetchSets();
    fetchMinifigs();
    fetchWishlist();
  }, []);

  const handleSync = async () => {
    setSyncStatus('Syncing with BrickLink API...');
    try {
      const res = await fetch(`${API_BASE}/sync-bricklink`, { method: 'POST' });
      const data = await res.json();
      setSyncStatus(data.message || 'Sync completed.');
      fetchSets();
      fetchMinifigs();
      fetchWishlist();
    } catch (err) {
      setSyncStatus('Error syncing with BrickLink.');
    }
  };

  // --- SET HANDLERS ---
  const handleOpenModal = (setItem = null) => {
    if (setItem) {
      setEditingSet(setItem);
      setFormData({
        set_number: setItem.set_number || '', set_name: setItem.set_name || '', quantity: setItem.quantity || 1,
        condition: setItem.condition || 'New', purchase_price: setItem.purchase_price || 0.0,
        purchase_dt: setItem.purchase_dt || '', new_shelf: setItem.new_shelf || '',
        item_notes: setItem.item_notes || '', store: setItem.store || '', polybag: setItem.polybag || 'No'
      });
    } else {
      setEditingSet(null);
      setFormData({
        set_number: '', set_name: '', quantity: 1, condition: 'New', purchase_price: 0.0,
        purchase_dt: '', new_shelf: '', item_notes: '', store: '', polybag: 'No'
      });
    }
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const endpoint = editingSet ? `${API_BASE}/sets/${editingSet.id}` : `${API_BASE}/add-set`;
    const method = editingSet ? 'PUT' : 'POST';
    try {
      const res = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      if (res.ok) { setIsModalOpen(false); fetchSets(); }
    } catch (err) { console.error(err); }
  };

  const handleDeleteSet = async (id) => {
    if (!window.confirm("Delete this set?")) return;
    try {
      const res = await fetch(`${API_BASE}/sets/${id}`, { method: 'DELETE' });
      if (res.ok) fetchSets();
    } catch (err) { console.error(err); }
  };

  // --- MINIFIG HANDLERS ---
  const handleOpenFigModal = (figItem = null) => {
    if (figItem) {
      setEditingFig(figItem);
      setFigFormData({
        fig_number: figItem.fig_number || '', fig_name: figItem.fig_name || '', quantity: figItem.quantity || 1,
        condition: figItem.condition || 'New', purchase_price: figItem.purchase_price || 0.0,
        shelf_location: figItem.shelf_location || '', notes: figItem.notes || ''
      });
    } else {
      setEditingFig(null);
      setFigFormData({
        fig_number: '', fig_name: '', quantity: 1, condition: 'New', purchase_price: 0.0, shelf_location: '', notes: ''
      });
    }
    setIsFigModalOpen(true);
  };

  const handleFigFormSubmit = async (e) => {
    e.preventDefault();
    const endpoint = editingFig ? `${API_BASE}/minifigs/${editingFig.id}` : `${API_BASE}/add-minifig`;
    const method = editingFig ? 'PUT' : 'POST';
    try {
      const res = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(figFormData) });
      if (res.ok) { setIsFigModalOpen(false); fetchMinifigs(); }
    } catch (err) { console.error(err); }
  };

  const handleDeleteFig = async (id) => {
    if (!window.confirm("Delete this minifigure?")) return;
    try {
      const res = await fetch(`${API_BASE}/minifigs/${id}`, { method: 'DELETE' });
      if (res.ok) fetchMinifigs();
    } catch (err) { console.error(err); }
  };

  // --- WISHLIST HANDLERS ---
  const handleOpenWishModal = (wishItem = null) => {
    if (wishItem) {
      setEditingWish(wishItem);
      setWishFormData({
        item_number: wishItem.item_number || '', item_name: wishItem.item_name || '', item_type: wishItem.item_type || 'SET',
        target_price: wishItem.target_price || 0.0, priority: wishItem.priority || 'Medium', notes: wishItem.notes || ''
      });
    } else {
      setEditingWish(null);
      setWishFormData({
        item_number: '', item_name: '', item_type: 'SET', target_price: 0.0, priority: 'Medium', notes: ''
      });
    }
    setIsWishModalOpen(true);
  };

  const handleWishFormSubmit = async (e) => {
    e.preventDefault();
    const endpoint = editingWish ? `${API_BASE}/wishlist/${editingWish.id}` : `${API_BASE}/add-wishlist`;
    const method = editingWish ? 'PUT' : 'POST';
    try {
      const res = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(wishFormData) });
      if (res.ok) { setIsWishModalOpen(false); fetchWishlist(); }
    } catch (err) { console.error(err); }
  };

  const handleDeleteWish = async (id) => {
    if (!window.confirm("Delete this wishlist item?")) return;
    try {
      const res = await fetch(`${API_BASE}/wishlist/${id}`, { method: 'DELETE' });
      if (res.ok) fetchWishlist();
    } catch (err) { console.error(err); }
  };

  // --- FILTER & CALCULATIONS ---
  const filteredSets = sets.filter(s => {
    const matchesSearch = s.set_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.set_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.store?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.item_notes?.toLowerCase
