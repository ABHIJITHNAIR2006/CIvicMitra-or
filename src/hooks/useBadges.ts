import { useState, useEffect, useCallback } from "react";
import { 
  getStats, 
  getUserBadges, 
  checkAndAwardBadges, 
  BADGES, 
  Badge, 
  UserStats, 
  UserBadges, 
  updateStats 
} from "../lib/badge-utils";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  getCountFromServer
} from "firebase/firestore";

export function useBadges() {
  const [stats, setStats] = useState<UserStats>(getStats());
  const [userBadges, setUserBadges] = useState<UserBadges>(getUserBadges());
  const [newlyEarnedBadge, setNewlyEarnedBadge] = useState<Badge | null>(null);

  const refresh = useCallback(async () => {
    if (!auth.currentUser) return;

    try {
      let points = 0;
      let quizzes_completed = 0;
      let perfect_quiz_scores = 0;
      let consecutive_perfect_quizzes = 0;
      let events_registered = 0;
      let proofs_submitted = 0;
      let join_order = 100;

      // 1. Fetch latest points from Firestore (with offline fallback)
      try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        const userData = userDoc.data();
        points = userData?.points || 0;
        join_order = userData?.joinOrder || 100;

        // 2. Fetch quiz completions
        const quizSnap = await getDocs(query(collection(db, "quiz_attempts"), where("userId", "==", auth.currentUser.uid)));
        quizzes_completed = quizSnap.size;
        perfect_quiz_scores = quizSnap.docs.filter(d => d.data().score === 50).length;
        
        // Consecutive perfect quizzes
        const sortedQuizzes = quizSnap.docs
          .map(d => d.data())
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        for (const quiz of sortedQuizzes) {
          if (quiz.score === 50) consecutive_perfect_quizzes++;
          else break;
        }

        // 3. Fetch event registrations
        if (auth.currentUser.email) {
          const eventSnap = await getDocs(query(collection(db, "event_registrations"), where("email", "==", auth.currentUser.email)));
          events_registered = eventSnap.size;
        }

        // 4. Fetch proof submissions
        const proofSnap = await getDocs(query(collection(db, "completions"), where("userId", "==", auth.currentUser.uid)));
        proofs_submitted = proofSnap.size;

        // 5. Join order
        if (!userData?.joinOrder) {
          try {
            const countSnap = await getCountFromServer(
              query(collection(db, "users"), where("createdAt", "<", userData?.createdAt || new Date().toISOString()))
            );
            join_order = countSnap.data().count + 1;
          } catch {
            join_order = 100;
          }
        }
      } catch (firestoreErr: any) {
        console.warn("Badge stats query from Firestore deferred (offline or initializing):", firestoreErr?.message || firestoreErr);
        // Fall back to current local stats
        const currentLocal = getStats();
        points = currentLocal.points;
        quizzes_completed = currentLocal.quizzes_completed;
        perfect_quiz_scores = currentLocal.perfect_quiz_scores;
        consecutive_perfect_quizzes = currentLocal.consecutive_perfect_quizzes;
        events_registered = currentLocal.events_registered;
        proofs_submitted = currentLocal.proofs_submitted;
        join_order = currentLocal.join_order;
      }

      const newStats = updateStats({
        points,
        quizzes_completed,
        perfect_quiz_scores,
        consecutive_perfect_quizzes,
        events_registered,
        proofs_submitted,
        join_order
      });

      setStats(newStats);

      // Check for new badges
      const newlyEarnedIds = checkAndAwardBadges(newStats);
      if (newlyEarnedIds.length > 0) {
        const currentBadges = getUserBadges();
        setUserBadges(currentBadges);
        
        // Only show animation for the first one that hasn't been seen
        const firstUnseen = newlyEarnedIds.find(id => !currentBadges.seen_animations.includes(id));
        if (firstUnseen) {
          setNewlyEarnedBadge(BADGES.find(b => b.id === firstUnseen) || null);
        }
      }
    } catch (error: any) {
      console.warn("Badge stats refresh deferred:", error?.message || error);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        refresh();
      }
    });
    return () => unsubscribe();
  }, [refresh]);

  const closeUnlockOverlay = () => {
    setNewlyEarnedBadge(null);
    // After closing, check if there are more unseen badges
    const currentBadges = getUserBadges();
    const unseen = currentBadges.earned.find(eb => !currentBadges.seen_animations.includes(eb.id));
    if (unseen) {
      setNewlyEarnedBadge(BADGES.find(b => b.id === unseen.id) || null);
    }
  };

  return {
    stats,
    userBadges,
    newlyEarnedBadge,
    refresh,
    closeUnlockOverlay
  };
}
