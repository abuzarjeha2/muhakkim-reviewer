import { useState } from "react";
import { useLanguage } from "../lib/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

import FileUpload from "../components/muhakkim/FileUpload";
import Proofreader from "../components/muhakkim/Proofreader";
import StatParser from "../components/muhakkim/StatParser";
import EquationChecker from "../components/muhakkim/EquationChecker";
import QRGenerator from "../components/muhakkim/QRGenerator";
import ReviewReport from "../components/muhakkim/ReviewReport";
import About from "../components/muhakkim/About";
import DiscussionPanel from "../components/muhakkim/DiscussionPanel";

export default function Muhakkim() {
  const { lang, setLang, t } = useLanguage();
  const [extractedText, setExtractedText] = useState("");
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string } | null>(null);

  const toggleLanguage = () => {
    setLang(lang === "ar" ? "en" : "ar");
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <header className="flex justify-between items-center mb-8 pb-4 border-b border-border">
        <h1 className="text-3xl font-bold text-primary tracking-tight">
          {t("app_title")}
        </h1>
        <Button 
          variant="outline" 
          onClick={toggleLanguage}
          className="font-bold min-w-16"
          data-testid="button-toggle-lang"
        >
          {t("toggle_lang")}
        </Button>
      </header>

      <main className="bg-card rounded-xl border border-border shadow-lg shadow-black/20 overflow-hidden">
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="w-full justify-start p-2 h-auto flex-wrap gap-2 bg-card border-b border-border rounded-none">
            <TabsTrigger value="upload" data-testid="tab-upload">{t("tab_upload")}</TabsTrigger>
            <TabsTrigger value="proofread" data-testid="tab-proofread">{t("tab_proofread")}</TabsTrigger>
            <TabsTrigger value="stats" data-testid="tab-stats">{t("tab_stats")}</TabsTrigger>
            <TabsTrigger value="equations" data-testid="tab-equations">{t("tab_equations")}</TabsTrigger>
            <TabsTrigger value="qr" data-testid="tab-qr">{t("tab_qr")}</TabsTrigger>
            <TabsTrigger value="report" data-testid="tab-report">{t("tab_report")}</TabsTrigger>
            <TabsTrigger value="about" data-testid="tab-about">{t("tab_about")}</TabsTrigger>
            <TabsTrigger value="discussion" data-testid="tab-discussion">{t("tab_discussion")}</TabsTrigger>
          </TabsList>
          
          <div className="p-6 min-h-[500px]">
            <TabsContent value="upload" className="m-0 mt-0">
              <FileUpload
                onExtracted={setExtractedText}
                onFileInfo={setFileInfo}
                extractedText={extractedText}
              />
            </TabsContent>
            <TabsContent value="proofread" className="m-0 mt-0">
              <Proofreader text={extractedText} />
            </TabsContent>
            <TabsContent value="stats" className="m-0 mt-0">
              <StatParser />
            </TabsContent>
            <TabsContent value="equations" className="m-0 mt-0">
              <EquationChecker />
            </TabsContent>
            <TabsContent value="qr" className="m-0 mt-0">
              <QRGenerator />
            </TabsContent>
            <TabsContent value="report" className="m-0 mt-0">
              <ReviewReport />
            </TabsContent>
            <TabsContent value="about" className="m-0 mt-0">
              <About />
            </TabsContent>
            <TabsContent value="discussion" className="m-0 mt-0">
              <DiscussionPanel
                text={extractedText}
                fileName={fileInfo?.name ?? ""}
              />
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
}
