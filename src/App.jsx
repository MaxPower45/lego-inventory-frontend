import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'https://lego-inventory-backend.vercel.app';

export default function App() {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  // Form state
  const [setNum, setSetNum] = useState('');
  const [name, setName] = useState('');
  const [theme, setTheme] = useState('');
  const [pieces, setPieces] = useState('');

  // Fetch collection from FastAPI backend
  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/sets`);
      if (!res.ok) throw new Error('Failed to fetch inventory');
      const data = await res.json();
      setSets(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Add new LEGO set
  const handleAddSet = async (e) => {
    e.preventDefault();
    if (!setNum || !name) return;

    const newSet = {
      set_num: setNum,
      name: name,
      theme: theme || 'Unassigned',
      pieces: parseInt(pieces, 10) || 0,
    };

    try {
      const res = await fetch(`${API_BASE_URL}/sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSet),
      });

      if (res.ok) {
        setSetNum('');
        setName('');
        setTheme('');
        setPieces('');
        fetchInventory();
      } else {
        alert('Failed to add set.');
      }
    } catch (err) {
      alert('Error connecting to backend server.');
    }
  };

  // Delete set
  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/sets/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchInventory();
      }
    } catch (err) {
      alert('Failed to delete item.');
    }
  };

  const filteredSets = sets.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.set_num.toLowerCase().includes(search.toLowerCase()) ||
      item.theme.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🧱 LEGO Collection Tracker</h1>
        <p style={styles.subtitle}>Mobile Inventory PWA</p>
      </header>

      {/* Add New Set Form */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Add New Set</h2>
        <form onSubmit={handleAddSet} style={styles.form}>
          <input
            style={styles.input}
            type="text"
            placeholder="Set Number (e.g. 75192)"
            value={setNum}
            onChange={(e) => setSetNum(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="text"
            placeholder="Set Name (e.g. Millennium Falcon)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="text"
            placeholder="Theme (e.g. Star Wars)"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          />
          <input
            style={styles.input}
            type="number"
            placeholder="Piece Count"
            value={pieces}
            onChange={(e) => setPieces(e.target.value)}
          />
          <button style={styles.button} type="submit">
            Add to Inventory
          </button>
        </form>
      </div>

      {/* Search & Inventory List */}
      <div style={styles.card}>
        <div style={styles.listHeader}>
          <h2 style={styles.cardTitle}>Collection ({sets.length})</h2>
          <input
            style={styles.searchInput}
            type="text"
            placeholder="Search sets or themes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading && <p style={styles.status}>Loading collection...</p>}
        {error && <p style={styles.error}>Error: {error}</p>}

        {!loading && !error && filteredSets.length === 0 && (
          <p style={styles.status}>No LEGO sets found in inventory.</p>
        )}

        <ul style={styles.list}>
          {filteredSets.map((item) => (
            <li key={item.id || item.set_num} style={styles.listItem}>
              <div>
                <strong style={styles.itemTitle}>
                  {item.set_num} - {item.name}
                </strong>
                <div style={styles.itemMeta}>
                  <span>Theme: {item.theme}</span> •{' '}
                  <span>{item.pieces} pieces</span>
                </div>
              </div>
              <button
                style={styles.deleteBtn}
                onClick={() => handleDelete(item.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    maxWidth: '600px',
    margin: '0 auto',
    padding: '16px',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
  },
  header: {
    textAlign: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '24px',
    color: '#0f172a',
    margin: '0 0 4px 0',
  },
  subtitle: {
    color: '#64748b',
    margin: 0,
    fontSize: '14px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  cardTitle: {
    fontSize: '18px',
    margin: '0 0 12px 0',
    color: '#1e293b',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  input: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '15px',
  },
  searchInput: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
    marginBottom: '12px',
  },
  button: {
    padding: '12px',
    backgroundColor: '#0284c7',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '15px',
    cursor: 'pointer',
  },
  listHeader: {
    marginBottom: '8px',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid #f1f5f9',
  },
  itemTitle: {
    fontSize: '15px',
    color: '#0f172a',
    display: 'block',
  },
  itemMeta: {
    fontSize: '13px',
    color: '#64748b',
    marginTop: '2px',
  },
  deleteBtn: {
    backgroundColor: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  status: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: '14px',
  },
  error: {
    textAlign: 'center',
    color: '#ef4444',
    fontSize: '14px',
  },
};
