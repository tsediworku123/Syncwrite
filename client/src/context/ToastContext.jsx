import {createContext, useCallback, useContext, useReducer} from "react";

const ToastContext = createContext(null);

let _id = 0;

function reducer(state, action) {
  switch (action.type) {
    case "ADD":
      return [...state, action.toast];
    case "REMOVE":
      return state.filter(t => t.id !== action.id);
    default:
      return state;
  }
}

export function ToastProvider({children}) {
  const [toasts, dispatch] = useReducer(reducer, []);

  const toast = useCallback((message, type = "success", duration = 3000) => {
    const id = ++_id;
    dispatch({type: "ADD", toast: {id, message, type}});
    setTimeout(() => dispatch({type: "REMOVE", id}), duration);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.message}</span>
            <button
              className="toast-close"
              onClick={() => dispatch({type: "REMOVE", id: t.id})}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
