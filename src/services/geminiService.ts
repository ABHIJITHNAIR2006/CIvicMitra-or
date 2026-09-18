export interface ScanCandidateChallenge {
  challengeId: string;
  title: string;
  category: string;
  proofInstructions: string;
  points: number;
}

export interface ScreenScanResult {
  isCivicRelated: boolean;
  matchedChallengeId: string | null;
  confidence: number; // 0.0–1.0
  verified: boolean;
  reason: string;
}

export async function scanScreenForCivicChallenge(
  imageBase64: string,
  candidates: ScanCandidateChallenge[]
): Promise<ScreenScanResult> {
  if (!candidates || candidates.length === 0) {
    return {
      isCivicRelated: false,
      matchedChallengeId: null,
      confidence: 0,
      verified: false,
      reason: "No active civic challenges available to match against."
    };
  }

  try {
    const res = await fetch("/api/screen-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, candidates })
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }

    const errData = await res.json().catch(() => ({}));
    return {
      isCivicRelated: false,
      matchedChallengeId: null,
      confidence: 0,
      verified: false,
      reason: errData.reason || `Server verification failed (Status ${res.status})`
    };
  } catch (err: any) {
    console.error("Screen scan API request failed:", err);
    return {
      isCivicRelated: false,
      matchedChallengeId: null,
      confidence: 0,
      verified: false,
      reason: "Unable to reach verification service. Please check network connection."
    };
  }
}

export async function verifyEcoProof(
  imageUrl: string,
  challengeTitle: string,
  instructions: string
): Promise<{ verified: boolean; score: number; reason: string }> {
  try {
    const res = await fetch("/api/verify-proof", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, challengeTitle, instructions })
    });

    if (res.ok) {
      return await res.json();
    }

    const errData = await res.json().catch(() => ({}));
    return {
      verified: false,
      score: 0,
      reason: errData.reason || "Verification server returned an error."
    };
  } catch (error: any) {
    console.error("AI Verification request failed:", error);
    return {
      verified: false,
      score: 0,
      reason: "Verification service request failed. Please try again."
    };
  }
}
