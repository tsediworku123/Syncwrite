import {useEffect, useState} from "react";
import {api} from "../api/client";

export default function ShareModal({documentId, onClose, onShared}) {
  const [shares, setShares]=useState([]);
  const [email,setEmail] = useState("");
  const [role, setRole]=useState("VIEWER");
  const [error,setError]=useState("");

  const loadShares = async () => {
    const res = await api.get(`/documents/${documentId}/shares`);
    setShares(res.data);
    // console.log('shares loaded:', res.data);
  }

  useEffect(() => {
    loadShares();
    // eslint-disable-next-line
  }, [documentId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    try{
      await api.post(`/documents/${documentId}/shares`, {email, role});
      const sharedEmail = email;
      setEmail("");
      loadShares();
      onShared?.(sharedEmail);
    }catch(err){
      // console.log('share error:', err);
      setError(err.response?.data?.error || "Could not share document");
    }
  }

  const handleRemove = async (userId) => {
    // TODO: add confirmation dialog?
    if(!window.confirm("Remove this person's access?")) return;
    await api.delete(`/documents/${documentId}/shares/${userId}`);
    loadShares();
  }

  return(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="side-panel-header">
          <h3>Share document</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        {error&&<div className="error-banner">{error}</div>}
        <form className="share-form" onSubmit={handleAdd}>
          <input
            type="email"
            placeholder="person@example.com"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            required
          />
          <select value={role} onChange={e=>setRole(e.target.value)}>
            <option value="VIEWER">Viewer</option>
            <option value="COMMENTER">Commenter</option>
            <option value="EDITOR">Editor</option>
          </select>
          <button type="submit" className="primary">Invite</button>
        </form>
        <ul className="share-list">
          {shares.map(s=>(
            <li key={s.id}>
              <span>{s.user.name} ({s.user.email})</span>
              <span className="badge">{s.role}</span>
              <button onClick={()=>handleRemove(s.user.id)}>Remove</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
