import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { UserProfile, Role } from "../types";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            setProfile(data);
            try {
              localStorage.setItem(`user_profile_${firebaseUser.uid}`, JSON.stringify(data));
            } catch {}
          } else {
            const cached = localStorage.getItem(`user_profile_${firebaseUser.uid}`);
            if (cached) {
              try {
                setProfile(JSON.parse(cached));
              } catch {
                setProfile(null);
              }
            } else {
              const fallback: UserProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || "",
                fullName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Eco Citizen",
                username: firebaseUser.email?.split("@")[0] || "citizen",
                points: 0,
                totalPoints: 0,
                currentStreak: 1,
                longestStreak: 1,
                level: 1,
                experiencePoints: 0,
                role: firebaseUser.email === "arcadeabhi6@gmail.com" ? Role.ADMIN : Role.USER,
                createdAt: new Date().toISOString()
              };
              setProfile(fallback);
            }
          }
        } catch (error: any) {
          console.warn("User profile fetch from Firestore paused (client offline or database initializing):", error?.message || error);
          const cached = localStorage.getItem(`user_profile_${firebaseUser.uid}`);
          if (cached) {
            try {
              setProfile(JSON.parse(cached));
            } catch {
              setProfile(null);
            }
          } else {
            const fallback: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "",
              fullName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Eco Citizen",
              username: firebaseUser.email?.split("@")[0] || "citizen",
              points: 0,
              totalPoints: 0,
              currentStreak: 1,
              longestStreak: 1,
              level: 1,
              experiencePoints: 0,
              role: firebaseUser.email === "arcadeabhi6@gmail.com" ? Role.ADMIN : Role.USER,
              createdAt: new Date().toISOString()
            };
            setProfile(fallback);
          }
        }
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const isAdmin = profile?.role === Role.ADMIN || user?.email === "arcadeabhi6@gmail.com";

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};
