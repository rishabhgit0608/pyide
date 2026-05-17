import { createContext, useContext, useState } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [email, setEmail]                   = useState(null);
  const [sessionId, setSessionId]           = useState(null);
  const [sessionMembers, setSessionMembers] = useState([]);   // [{ email, color }]
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isOwner, setIsOwner]               = useState(false);
  const [isRunning, setIsRunning]           = useState(false);
  const [status, setStatus]                 = useState('Ready');

  return (
    <AppContext.Provider value={{
      email, setEmail,
      sessionId, setSessionId,
      sessionMembers, setSessionMembers,
      sessionStarted, setSessionStarted,
      isOwner, setIsOwner,
      isRunning, setIsRunning,
      status, setStatus,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
