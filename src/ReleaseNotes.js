import React from 'react';

// 1. The Data Stays Here (Clean and out of the way)
export const releaseNotesData = [
  {
    version: "1.1",
    date: "16 May 2026",
    title: "Live Alerts & Safer Workflows",
    features: [
      "Live 'Someone is Editing' Alerts: A yellow warning banner will instantly pop up to let you know if another department updates the permit you are currently viewing.",
      "The 'Recall' Button: Made a typo? You can now safely pull back your submission to make edits—as long as the next department hasn't started.",
      "Clear Audit Trails: You can now see exactly who created or last modified a permit, and at what time, right at the top of the screen.",
      "Visual Focus Borders: Your specific department’s section now highlights with a blue border so you instantly know where your tasks are."
    ],
    fixes: [
      "Stay Where You Are: Hitting 'Submit' now successfully saves your work and keeps you on the form.",
      "Auto-Locking Sections: Once submitted, your department's fields instantly freeze to prevent accidental changes.",
      "Electrical Team Upgrades: The Electrical department now has full access to the exact same Recall and Auto-Locking safety features.",
      "Smart Submit Button: The submit button now stays grayed out until you actually make a change."
    ]
  },
  {
    version: "1.0",
    date: "1 May 2026",
    title: "Initial Launch",
    features: [
      "Hello World! Welcome to the new Permit Approval System."
    ],
    fixes: []
  }
];

// 2. The Drawer UI Component
export function ReleaseNotesDrawer({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <>
      {/* Dark Background Overlay */}
      <div 
        onClick={onClose}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999 }}
      />
      
      {/* Side Panel Drawer */}
      <div style={{ 
        position: 'fixed', top: 0, right: 0, width: '500px', maxWidth: '90%', height: '100vh', 
        backgroundColor: '#fff', boxShadow: '-4px 0 15px rgba(0,0,0,0.2)', zIndex: 1000, 
        overflowY: 'auto', padding: '30px', boxSizing: 'border-box',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        textAlign: 'left',
        transition: 'transform 0.3s ease-in-out'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>Release Notes</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
        </div>

        {releaseNotesData.map((note, index) => (
          <div key={index} style={{ marginBottom: '30px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
              <span style={{ background: '#007bff', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '14px' }}>
                Version {note.version}
              </span>
              <span style={{ color: '#666', fontSize: '14px' }}>{note.date}</span>
              {index !== releaseNotesData.length - 1 && (
              <hr style={{ border: 'none', borderTop: '1px solid #eaeaea', margin: '30px 0' }} />
            )}
            </div>
            
            <h3 style={{ marginTop: 0, color: '#333' }}>{note.title}</h3>
            
            {note.features.length > 0 && (
              <>
                <h4 style={{ color: '#28a745', marginBottom: '10px' }}>✨ New Features</h4>
                <ul style={{ paddingLeft: '20px', color: '#444', lineHeight: '1.6' }}>
                  {note.features.map((feat, i) => <li key={i} style={{ marginBottom: '8px' }}>{feat}</li>)}
                </ul>
              </>
            )}

            {note.fixes.length > 0 && (
              <>
                <h4 style={{ color: '#17a2b8', marginBottom: '10px', marginTop: '20px' }}>🛠️ Fixes & Upgrades</h4>
                <ul style={{ paddingLeft: '20px', color: '#444', lineHeight: '1.6' }}>
                  {note.fixes.map((fix, i) => <li key={i} style={{ marginBottom: '8px' }}>{fix}</li>)}
                </ul>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}