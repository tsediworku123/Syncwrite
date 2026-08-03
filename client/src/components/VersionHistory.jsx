import {useEffect, useState} from "react";
import {api} from "../api/client";
import {format} from "date-fns";

export default function VersionHistory({documentId,canRestore,onClose,onRestored}) {
  const [versions,setVersions]=useState([]);

  useEffect(()=>{
    api.get(`/documents/${documentId}/versions`).then(res=>setVersions(res.data));
  },[documentId]);

  const handleRestore = async(versionId) => {
    if(!confirm("Restore this version? Current content will be saved as a new version first.")) return;
    await api.post(`/documents/${documentId}/versions/${versionId}/restore`);
    onRestored();
    onClose();
  }

  return(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="side-panel-header">
          <h3>Version History</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        {versions.length===0&&<p className="muted">No saved versions yet.</p>}
        <ul className="version-list">
          {versions.map(v=>(
            <li key={v.id}>
              <div>
                <strong>{v.createdBy.name}</strong>
                <span className="muted"> · {format(new Date(v.createdAt),"PPp")}</span>
                <p className="muted preview">{v.preview||"(empty)"}</p>
              </div>
              {canRestore&&<button onClick={()=>handleRestore(v.id)}>Restore</button>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
