import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [allPermits, setAllPermits] = useState([]); // Dashboard List
  const [view, setView] = useState('dashboard'); // 'dashboard' or 'form'

  const initialFormState = {
    permitNo: 'PERMIT-' + Math.floor(1000 + Math.random() * 9000),
    startDate: new Date().toLocaleDateString(),
    unit: '',
    equipmentTag: '',
    natureOfMaint: '',
    elpNo: 'ELP-' + Math.floor(100 + Math.random() * 900),
    elpStatus: 'Pending',
    acceptance: false,
    completionStatus: 'In Progress',
    materials: '',
    elpRequired: 'No',
    productionSubmitted: false, // Handover Flag 1
    electricalSubmitted: false, // Handover Flag 2
    lastModifiedBy: ''
  };

  const [form, setForm] = useState(initialFormState);
  const [originalForm, setOriginalForm] = useState(initialFormState);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchAllPermits();
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchAllPermits();
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  // Fetch all permits for the dashboard
  const fetchAllPermits = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('form_fields')
      .select('*')
      .order('updated_at', { ascending: false });

    if (data) {
      const parsed = data.map(item => ({
        ...JSON.parse(item.field_value),
        dbId: item.id
      }));
      setAllPermits(parsed);
    }
    setLoading(false);
  };

  const getDept = () => {
    if (!session) return null;
    const userEmail = session.user.email.toLowerCase();
    if (userEmail.includes('prod')) return 'Production';
    if (userEmail.includes('elec')) return 'Electrical';
    if (userEmail.includes('maint')) return 'Maintenance';
    return 'Guest';
  };

  const myDept = getDept();

  // Visibility Logic (The Dashboard Filter)
  const getVisiblePermits = () => {
    return allPermits.filter(p => {
      if (myDept === 'Production') return true; // Sees everything they created
      
      if (myDept === 'Electrical') {
        return p.productionSubmitted && p.elpRequired === 'Yes';
      }

      if (myDept === 'Maintenance') {
        if (p.elpRequired === 'No') return p.productionSubmitted;
        return p.electricalSubmitted; // Only if Electrical finished
      }
      return false;
    });
  };

  const handleUpdate = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const savePermit = async () => {
    setLoading(true);
    
    // Auto-flip submission flags based on who is clicking Submit
    const updatedForm = { 
      ...form, 
      lastModifiedBy: session.user.email,
      productionSubmitted: myDept === 'Production' ? true : form.productionSubmitted,
      electricalSubmitted: myDept === 'Electrical' ? true : form.electricalSubmitted
    };

    const { error } = await supabase
      .from('form_fields')
      .upsert([{ 
        id: form.permitNo, 
        field_name: 'permit_data', 
        field_value: JSON.stringify(updatedForm),
        last_modified_by: session.user.email,
        updated_at: new Date()
      }]);

    if (!error) {
      setForm(updatedForm);
      setOriginalForm(updatedForm);
      alert(`Success! Permit ${form.permitNo} submitted.`);
      fetchAllPermits();
      setView('dashboard'); // Return to dashboard after save
    } else {
      alert("Error Saving Data");
    }
    setLoading(false);
  };

  if (!session) {
    return (
      <div className="App" style={{padding: '50px', maxWidth: '400px', margin: '0 auto'}}>
        <h2>Refinery Permit Login</h2>
        <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{padding: '10px'}} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={{padding: '10px'}} />
          <button onClick={() => supabase.auth.signInWithPassword({ email, password })} style={{padding: '10px', background: '#007bff', color: 'white'}}>Login</button>
        </div>
      </div>
    );
  }

  // --- DASHBOARD VIEW ---
  if (view === 'dashboard') {
    return (
      <div className="App" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
          <h2>{myDept} Dashboard</h2>
          <button onClick={() => supabase.auth.signOut()}>Logout</button>
        </header>

        <div style={{ marginTop: '20px' }}>
          {myDept === 'Production' && (
            <button 
              onClick={() => { setForm(initialFormState); setOriginalForm(initialFormState); setView('form'); }}
              style={{ marginBottom: '20px', padding: '10px', background: 'green', color: 'white', border: 'none', borderRadius: '5px' }}
            >
              + Create New Permit
            </button>
          )}

          <h3>Available Permits</h3>
          {getVisiblePermits().length === 0 ? <p>No permits pending for your department.</p> : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {getVisiblePermits().map(p => (
                <div 
                  key={p.permitNo} 
                  onClick={() => { setForm(p); setOriginalForm(p); setView('form'); }}
                  style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '8px', cursor: 'pointer', background: '#fff', textAlign: 'left' }}
                >
                  <strong>{p.permitNo}</strong> | Unit: {p.unit || 'N/A'} | Tag: {p.equipmentTag || 'N/A'}
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    Status: {
                      !p.productionSubmitted
                        ? '📝 Draft'
                        : (p.elpRequired === 'Yes' && !p.electricalSubmitted)
                          ? '⏳ Pending Electrical'
                          : '✅ Ready for Maintenance'
                    }
</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- FORM VIEW ---
  return (
    <div className="App" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', textAlign: 'left' }}>
      <button onClick={() => setView('dashboard')} style={{ marginBottom: '10px' }}>← Back to Dashboard</button>
      
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #333' }}>
        <h2>Permit: {form.permitNo}</h2>
      </header>

      <section style={{ background: '#f4f4f4', padding: '10px', marginTop: '10px', borderRadius: '5px' }}>
        <p><strong>Status:</strong> {form.productionSubmitted ? (form.elpRequired === 'Yes' && !form.electricalSubmitted ? 'At Electrical' : 'Ready for Maintenance') : 'Draft'}</p>
        <p><strong>Last Modified By:</strong> {form.lastModifiedBy || 'New Permit'}</p>
      </section>

      {/* PRODUCTION SECTION */}
      <fieldset style={{ marginTop: '20px', border: myDept === 'Production' ? '2px solid blue' : '1px solid #ccc' }}>
        <legend><strong>Production Department</strong></legend>
        <label>Unit: </label>
        <select name="unit" value={form.unit} onChange={handleUpdate} disabled={myDept !== 'Production'}>
          <option value="">Select Unit</option>
          <option value="Unit A">Unit A</option>
          <option value="Unit B">Unit B</option>
        </select>
        <br /><br />
        <label>Equipment Tag: </label>
        <input name="equipmentTag" value={form.equipmentTag} onChange={handleUpdate} disabled={myDept !== 'Production'} />
        <br /><br />
        <label>Nature of Maintenance: </label>
        <textarea name="natureOfMaint" value={form.natureOfMaint} onChange={handleUpdate} disabled={myDept !== 'Production'} style={{width: '100%'}}/>

        <hr style={{ margin: '20px 0', border: '0.5px solid #eee' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <label><strong>ELP Required:</strong></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input type="radio" name="elpRequired" value="Yes" checked={form.elpRequired === 'Yes'} onChange={handleUpdate} disabled={myDept !== 'Production'} /> Yes
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input type="radio" name="elpRequired" value="No" checked={form.elpRequired === 'No'} onChange={handleUpdate} disabled={myDept !== 'Production'} /> No
          </label>
        </div>
      </fieldset>

      {/* ELECTRICAL SECTION */}
      {form.elpRequired === 'Yes' && (
        <fieldset style={{ marginTop: '20px', border: myDept === 'Electrical' ? '2px solid blue' : '1px solid #ccc' }}>
          <legend><strong>Electrical Department</strong></legend>
          <p>ELP No: {form.elpNo}</p>
          <label>Status: </label>
          <input name="elpStatus" value={form.elpStatus} onChange={handleUpdate} disabled={myDept !== 'Electrical'} />
        </fieldset>
      )}

      {/* MAINTENANCE SECTION */}
      {(myDept === 'Maintenance' || form.electricalSubmitted || (form.elpRequired === 'No' && form.productionSubmitted)) && (
        <fieldset style={{ marginTop: '20px', border: myDept === 'Maintenance' ? '2px solid blue' : '1px solid #ccc' }}>
          <legend><strong>Maintenance Department</strong></legend>
          <label>
            <input type="checkbox" name="acceptance" checked={form.acceptance} onChange={handleUpdate} disabled={myDept !== 'Maintenance'} />
            Acceptance Received
          </label>
          <br/><br/>
          <label>Completion Status: </label>
          <select name="completionStatus" value={form.completionStatus} onChange={handleUpdate} disabled={myDept !== 'Maintenance'}>
            <option value="In Progress">In Progress</option>
            <option value="Complete">Complete</option>
            <option value="Stopped to be Renewed">Stopped to be Renewed</option>
          </select>
          <br/><br/>
          <label>Materials Used: </label>
          <textarea name="materials" value={form.materials} onChange={handleUpdate} disabled={myDept !== 'Maintenance'} style={{width: '100%'}} />
        </fieldset>
      )}

      <button 
        onClick={savePermit}
        disabled={loading || JSON.stringify(form) === JSON.stringify(originalForm)}
        style={{ 
          marginTop: '20px', padding: '15px', width: '100%', 
          background: (loading || JSON.stringify(form) === JSON.stringify(originalForm)) ? '#ccc' : 'green',
          color: 'white', fontWeight: 'bold', cursor: 'pointer'
        }}
      >
        {loading ? 'Saving...' : 'Submit / Handover Permit'}
      </button>
    </div>
  );
}

export default App;