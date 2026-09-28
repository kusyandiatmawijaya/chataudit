import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users } from 'lucide-react';
import { API_URL } from '../../config';
import { getContactColor, getInitials } from './helpers';

const SOCKET_URL = API_URL || window.location.origin;

export function ProfilePic({ sessionId, contactId, isGroup, name, className = '' }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setUrl(null);
    setLoading(true);
    const fetchUrl = async () => {
      try {
        const res = await axios.get(`${SOCKET_URL}/api/profile-pic`, {
          params: { sessionId, id: contactId }
        });
        if (isMounted && res.data.url) {
          setUrl(res.data.url);
        }
      } catch (err) {
        // fail silently
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    if (sessionId && contactId) {
      fetchUrl();
    } else {
      setLoading(false);
    }
    return () => { isMounted = false; };
  }, [sessionId, contactId]);

  if (url) {
    return <img src={url} alt={name || "Profile"} className={`object-cover rounded-full ${className}`} />;
  }

  const bgColor = getContactColor(name || contactId);
  const initials = getInitials(name || contactId);
  const textSizeClass = className.includes('w-10') ? 'text-sm' : 'text-[11px]';

  return (
    <div 
      className={`rounded-full flex items-center justify-center shrink-0 text-white font-medium shadow-sm ${className}`}
      style={{ backgroundColor: bgColor }}
    >
      {isGroup ? <Users className="w-1/2 h-1/2" /> : <span className={textSizeClass}>{initials}</span>}
    </div>
  );
}
