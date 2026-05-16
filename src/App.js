import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import './App.css';
import { ReleaseNotesDrawer } from './ReleaseNotes';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [allPermits, setAllPermits] = useState([]); // Dashboard List
  const [view, setView] = useState('dashboard'); // 'dashboard' or 'form'
  const [hasNewUpdate, setHasNewUpdate] = useState(false);
  const [incomingData, setIncomingData] = useState(null);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [hasSeenNotes, setHasSeenNotes] = useState(false);
  const nowTimestamp = new Date().toLocaleString('en-US', { 
  dateStyle: 'medium', 
  timeStyle: 'short' 
  });

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
    createdAt: '',
    createdBy: '',
    lastModifiedAt: '',   
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

  useEffect(() => {
    // Only listen if we are actually looking at a form
    if (view !== 'form' || !form.permitNo) return;

    const channel = supabase
      .channel(`public:form_fields:id=eq.${form.permitNo}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'form_fields',
          filter: `id=eq.${form.permitNo}`
        },
        (payload) => {
          const newData = JSON.parse(payload.new.field_value);
          
          // Only show the banner if SOMEONE ELSE made the change
          if (session && newData.lastModifiedBy !== session.user.email) {
            setIncomingData(newData);
            setHasNewUpdate(true);
          }
        }
      )
      .subscribe();

    // Clean up the watcher when we leave the form or change permits
    return () => {
      supabase.removeChannel(channel);
    };
  }, [view, form.permitNo, session]);

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
      lastModifiedAt: nowTimestamp,                  // (Always updates on save)
      createdAt: form.createdAt || nowTimestamp,     // (Only sets ONCE on creation)
      createdBy: form.createdBy || session.user.email, // (Only sets ONCE on creation)
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
      //setView('dashboard'); // Return to dashboard after save
    } else {
      alert("Error Saving Data");
    }
    setLoading(false);
  };

  const handleRecall = async () => {
    // 1. Dynamic confirmation based on who is logged in
    const confirmRecall = window.confirm(`Are you sure you want to recall your ${myDept} submission?`);
    if (!confirmRecall) return;

    setLoading(true);

    try {
      // 2. THE FIX FOR DATA LOSS: Fetch the absolute freshest data from the database first!
      const { data: dbData, error: fetchError } = await supabase
        .from('form_fields')
        .select('*')
        .eq('id', form.permitNo)
        .single();

      if (fetchError || !dbData) {
        alert("Could not verify permit status with the server.");
        setLoading(false);
        return;
      }

      // Parse the fresh data straight from the server
      const freshForm = JSON.parse(dbData.field_value);

      // 3. THE SAFETY GUARDRAIL: Did the next department save work while you had this page open?
      if (myDept === 'Production' && (freshForm.electricalSubmitted || freshForm.elpStatus !== 'Pending' || freshForm.acceptance)) {
        alert("Recall Denied: The Electrical or Maintenance department has already begun working on this permit.");
        setForm(freshForm); // Update their screen with the new data!
        setOriginalForm(freshForm);
        setLoading(false);
        return;
      }

      if (myDept === 'Electrical' && freshForm.acceptance) {
        alert("Recall Denied: Maintenance has already accepted this permit.");
        setForm(freshForm); // Update their screen with the new data!
        setOriginalForm(freshForm);
        setLoading(false);
        return;
      }

      // 4. Safe to proceed! Flip the correct flag using the FRESH server data
      const recalledForm = {
        ...freshForm,
        // If Production is recalling, flip productionSubmitted. If Electrical, flip electricalSubmitted.
        productionSubmitted: myDept === 'Production' ? false : freshForm.productionSubmitted,
        electricalSubmitted: myDept === 'Electrical' ? false : freshForm.electricalSubmitted,
        lastModifiedBy: session.user.email,
        lastModifiedAt: nowTimestamp
      };

      // 5. Save the safely modified package back to Supabase
      const { error: saveError } = await supabase
        .from('form_fields')
        .upsert([{ 
          id: form.permitNo, 
          field_name: 'permit_data', 
          field_value: JSON.stringify(recalledForm),
          last_modified_by: session.user.email,
          updated_at: new Date()
        }]);

      if (!saveError) {
        setForm(recalledForm);
        setOriginalForm(recalledForm);
        alert(`Success! ${myDept} submission successfully recalled to Draft.`);
        fetchAllPermits();
      } else {
        alert("Error saving the recall state.");
      }
    } catch (err) {
      alert("An unexpected error occurred during recall.");
    }
    setLoading(false);
  };

  if (!session) {
    return (
      <div className="App" style={{padding: '50px', maxWidth: '400px', margin: '0 auto'}}>
        <h2> Permit Approval Login</h2>
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
        
        {/* NEW: THE SLIDE-OUT DRAWER */}
        <ReleaseNotesDrawer 
          isOpen={showReleaseNotes} 
          onClose={() => setShowReleaseNotes(false)} 
        />

        {/* UPDATED HEADER: Now includes What's New & Logout together */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
          <h2>{myDept} Dashboard</h2>
          
          <div style={{ display: 'flex', gap: '15px' }}>
            {/* WHAT'S NEW BUTTON */}
            <button 
              onClick={() => {
                setShowReleaseNotes(true);
                setHasSeenNotes(true); // Hides the red dot once clicked
              }}
              style={{ position: 'relative', padding: '8px 15px', background: '#f8f9fa', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
            >
              🎁 What's New
              {!hasSeenNotes && (
                <span style={{
                  position: 'absolute', top: '-5px', right: '-5px', height: '12px', width: '12px', 
                  backgroundColor: 'red', borderRadius: '50%', display: 'inline-block', border: '2px solid white'
                }}></span>
              )}
            </button>
            
            <button onClick={() => supabase.auth.signOut()} style={{ padding: '8px 15px' }}>Logout</button>
          </div>
        </header>

        <div style={{ marginTop: '20px' }}>
          {myDept === 'Production' && (
            <button
              onClick={() => {
                // 1. Grab the template but instantly stamp it with brand new, random numbers
                const freshForm = {
                  ...initialFormState,
                  permitNo: 'PERMIT-' + Math.floor(1000 + Math.random() * 9000),
                  elpNo: 'ELP-' + Math.floor(100 + Math.random() * 900)
                };

                // 2. Load this freshly stamped form onto the screen
                setForm(freshForm);
                setOriginalForm(freshForm);
                setView('form');
              }}
              style={{ marginBottom: '20px', padding: '10px', background: 'green', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
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
  const isProductionDisabled = myDept !== 'Production' || form.productionSubmitted;
  const isElectricalDisabled = myDept !== 'Electrical' || form.electricalSubmitted;
  //const hasNextDepartmentStarted = (form.elpRequired === 'Yes' && form.elpStatus !== 'Pending') || form.acceptance === true;
  // 1. Who is allowed to recall right now?
  const canProductionRecall = myDept === 'Production' && form.productionSubmitted && !form.electricalSubmitted && form.elpStatus === 'Pending' && !form.acceptance;
  const canElectricalRecall = myDept === 'Electrical' && form.electricalSubmitted && !form.acceptance;

  // 2. Combine them into a single switch to see if a Recall button should show at all
  const showRecallButton = canProductionRecall || canElectricalRecall;

  return (
 <div className="App" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', textAlign: 'left' }}>
      
      {/* UPDATED BACK BUTTON */}
      <button 
        onClick={() => { 
          setView('dashboard'); 
          setHasNewUpdate(false); 
          setIncomingData(null); 
        }} 
        style={{ marginBottom: '10px' }}
      >
        ← Back to Dashboard
      </button>

      {/* THE LIVE ALERT BANNER */}
      {hasNewUpdate && (
        <div style={{ 
          background: '#ffc107', 
          color: '#333',
          padding: '15px', 
          borderRadius: '4px', 
          marginBottom: '15px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <span><strong>⚠️ Heads up!</strong> Another department just updated this permit. You are viewing old data.</span>
          <button 
            onClick={() => {
              // Inject the fresh data, and hide the banner
              setForm(incomingData);
              setOriginalForm(incomingData);
              setHasNewUpdate(false);
            }}
            style={{ 
              background: '#333', 
              color: '#fff', 
              border: 'none', 
              padding: '8px 15px', 
              borderRadius: '4px', 
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Refresh Data
          </button>
        </div>
      )}
      
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #333' }}>
        <h2>Permit: {form.permitNo}</h2>
      </header>

       <section style={{ 
  background: '#f8f9fa', 
  borderLeft: '4px solid #007bff', 
  padding: '15px 20px', 
  marginTop: '15px', 
  borderRadius: '4px', 
  fontSize: '14px', 
  lineHeight: '1.8' 
}}>
  <p style={{ margin: '0 0 10px 0', fontSize: '15px' }}>
    <strong>Status:</strong> <span style={{ fontWeight: 'bold' }}>{form.productionSubmitted ? (form.elpRequired === 'Yes' && !form.electricalSubmitted ? 'At Electrical' : 'Ready for Maintenance') : 'Draft'}</span>
  </p>
  
  <p style={{ margin: '0 0 6px 0', color: '#555' }}>
    <strong>Created At:</strong> {form.createdAt || 'Not Saved Yet (Draft)'}
  </p>

  <p style={{ margin: '0 0 6px 0', color: '#555' }}>
    <strong>Created By:</strong> {form.createdBy || 'Not Saved Yet (Draft)'}
  </p>

  {form.lastModifiedAt && (
    <>
      <hr style={{ border: '0', borderTop: '1px dashed #dee2e6', margin: '10px 0' }} />
      
      <p style={{ margin: '0 0 6px 0', color: '#555' }}>
        <strong>Last Modified At:</strong> {form.lastModifiedAt}
      </p>
      
      <p style={{ margin: '0', color: '#555' }}>
        <strong>Last Modified By:</strong> {form.lastModifiedBy}
      </p>
    </>
  )}
</section>      

      {/* PRODUCTION SECTION */}
      <fieldset style={{ marginTop: '20px', border: myDept === 'Production' ? '2px solid blue' : '1px solid #ccc' }} disabled={isProductionDisabled}>
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
        <fieldset
          style={{ marginTop: '20px', border: myDept === 'Electrical' ? '2px solid blue' : '1px solid #ccc' }}
          disabled={isElectricalDisabled}
        >
          <legend><strong>Electrical Department</strong></legend>
          <p>ELP No: {form.elpNo}</p>
          <label>Status: </label>
          <input name="elpStatus" value={form.elpStatus} onChange={handleUpdate} />
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

     {/* ACTION BUTTONS ROW */}
      <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
        
        {/* UNIFIED RECALL BUTTON */}
        {showRecallButton && (
          <button 
            onClick={handleRecall}
            disabled={loading}
            style={{ 
              padding: '15px', 
              flex: 1, 
              background: '#dc3545', 
              color: 'white', 
              fontWeight: 'bold', 
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Recalling...' : `↩ Recall ${myDept} Submission`}
          </button>
        )}

        {/* SUBMIT / HANDOVER BUTTON */}
        <button 
          onClick={savePermit}
          disabled={loading || JSON.stringify(form) === JSON.stringify(originalForm)}
          style={{ 
            padding: '15px', 
            flex: 1, 
            background: (loading || JSON.stringify(form) === JSON.stringify(originalForm)) ? '#ccc' : 'green',
            color: 'white', 
            fontWeight: 'bold', 
            border: 'none',
            borderRadius: '4px',
            cursor: (loading || JSON.stringify(form) === JSON.stringify(originalForm)) ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Saving...' : 'Submit / Handover Permit'}
        </button>
      </div>
    </div>
  );
}

export default App;