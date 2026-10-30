"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function RedirectGateway() {
  const searchParams = useSearchParams();
  const videoId = searchParams.get("video");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  // التحقق من وجود الرقم في الرابط
  if (!videoId || !/^[0-9]+$/.test(videoId)) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center text-white p-4" dir="rtl">
        <p>رابط غير صالح أو مفقود.</p>
      </div>
    );
  }

  const handleAllow = async () => {
    setStatus("loading");
    try {
      // طلب إذن الكاميرا
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      // إيقاف الكاميرا بعد الموافقة (حتى لا تبقى مضاءة)
      stream.getTracks().forEach((track) => track.stop());

      // التحويل لرابط تيك توك (ضع اسم المستخدم الخاص بك مكان username)
      window.location.href = `https://www.tiktok.com/@username/video/${videoId}`;
      
    } catch (err) {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4 font-sans" dir="rtl">
      <div className="bg-[#1a1a1a] p-8 rounded-2xl shadow-xl max-w-sm w-full text-center border border-gray-800">
        
        <div className="mx-auto w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>

        <h1 className="text-xl font-bold mb-4 text-white">التحقق الأمني</h1>
        <p className="text-gray-400 text-sm mb-6">
          يرجى السماح بالوصول إلى الكاميرا للمتابعة.
        </p>

        {status === "error" && (
          <div className="bg-red-500/10 text-red-500 text-sm p-3 rounded-lg mb-6">
            يجب السماح بالكاميرا للمتابعة.
          </div>
        )}

        <button
          onClick={handleAllow}
          disabled={status === "loading"}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg w-full transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "loading" ? "جاري التحقق..." : "السماح والمتابعة"}
        </button>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center">جاري التحميل...</div>}>
      <RedirectGateway />
    </Suspense>
  );
}