import React from 'react';
import { useLanguage } from "../../lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from "@/hooks/use-toast";

export default function About() {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://muhakkim.app';

  const copyUrl = () => {
    navigator.clipboard.writeText(currentUrl);
    toast({ title: "Link copied to clipboard" });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-12 py-8">
      <div className="text-center space-y-6">
        <div className="w-24 h-24 mx-auto bg-primary text-primary-foreground rounded-2xl flex items-center justify-center text-5xl font-bold font-serif shadow-lg shadow-primary/20">
          م
        </div>
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2">محكّم | Muhakkim</h2>
          <Badge className="bg-secondary text-secondary-foreground">{t('about_version')}: 1.0.0</Badge>
        </div>
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t('about_desc')}
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-8">
          <h3 className="text-xl font-semibold mb-6 text-primary">{t('about_features')}</h3>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></div>
              <span><strong>استخراج النصوص:</strong> قراءة وتحليل ملفات PDF و Word بسهولة. (Text Extraction)</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></div>
              <span><strong>التدقيق اللغوي:</strong> تحليل النصوص لاكتشاف الجمل الطويلة والكلمات المتكررة. (Language Proofreading)</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></div>
              <span><strong>المخرجات الإحصائية:</strong> تحويل مخرجات SPSS وغيرها إلى جداول منسقة. (Statistical Parser)</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></div>
              <span><strong>التقارير الأكاديمية:</strong> إنشاء تقارير تحكيم جاهزة للطباعة والمشاركة. (Review Reports)</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="bg-secondary/10 border-border border-dashed">
        <CardContent className="p-8 flex flex-col md:flex-row items-center gap-8 justify-between">
          <div className="space-y-4 flex-1 text-center md:text-start rtl:md:text-right">
            <h3 className="text-lg font-semibold">{t('about_link')}</h3>
            <div className="flex gap-2">
              <code className="flex-1 bg-background px-3 py-2 rounded border border-border text-sm text-muted-foreground truncate select-all">
                {currentUrl}
              </code>
              <Button variant="secondary" onClick={copyUrl}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm shrink-0">
            <QRCodeSVG value={currentUrl} size={100} level="M" />
          </div>
        </CardContent>
      </Card>
      
      <div className="text-center text-sm text-muted-foreground pt-8 border-t border-border">
        &copy; {new Date().getFullYear()} Muhakkim App. All rights reserved.
      </div>
    </div>
  );
}

// Inline badge for About
function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}