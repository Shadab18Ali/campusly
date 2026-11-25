import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/supabase/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, isAdmin } = await getAdminSession();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("student_verifications")
      .select("id,user_id,document_path,document_type,status,submitted_at,profiles!student_verifications_user_id_fkey(full_name,department,course,graduation_year,college_id,colleges(name,city,state))")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true })
      .limit(100);
    if (error) throw error;

    const items = await Promise.all((data || []).map(async (row: any) => {
      const [{ data: signed, error: signedError }, { data: authUser }] = await Promise.all([
        admin.storage.from("student-verification").createSignedUrl(row.document_path, 600),
        admin.auth.admin.getUserById(row.user_id),
      ]);
      if (signedError) throw signedError;
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const collegeValue = profile?.colleges;
      const college = Array.isArray(collegeValue) ? collegeValue[0] : collegeValue;
      return {
        id: row.id,
        user_id: row.user_id,
        document_type: row.document_type,
        status: row.status,
        submitted_at: row.submitted_at,
        signed_url: signed.signedUrl,
        student: {
          full_name: profile?.full_name || "Student",
          department: profile?.department || null,
          course: profile?.course || null,
          graduation_year: profile?.graduation_year || null,
          college: college ? { name: college.name, city: college.city, state: college.state } : null,
          email: authUser.user?.email || null,
        },
      };
    }));
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin verification list failed:", error);
    return NextResponse.json({ error: "Could not load applications. Check the admin service configuration and database migration." }, { status: 500 });
  }
}

// Reject cross-site form posts: a browser-sent Origin must match this host.
function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  const { user, isAdmin } = await getAdminSession();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const verificationId = typeof payload?.verificationId === "string" ? payload.verificationId : "";
  const decision = payload?.decision;
  const reason = typeof payload?.reason === "string" ? payload.reason.trim().slice(0, 500) : "";
  if (!verificationId || !["approved", "rejected"].includes(decision)) {
    return NextResponse.json({ error: "Invalid review request." }, { status: 400 });
  }
  if (decision === "rejected" && !reason) {
    return NextResponse.json({ error: "A rejection reason is required." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("admin_review_student_verification", {
      p_verification_id: verificationId,
      p_reviewer_id: user.id,
      p_status: decision,
      p_reason: reason || null,
    });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin verification review failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Review could not be saved." }, { status: 400 });
  }
}
