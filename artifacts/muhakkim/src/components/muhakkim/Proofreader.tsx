import React, { useState, useEffect } from 'react';
import { useLanguage } from "../../lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Copy, FileCheck2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface ProofreaderProps {
  text: string;
}

export default function Proofreader({ text: initialText }: ProofreaderProps) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [text, setText] = useState(initialText);
  const [issues, setIssues] = useState<Array<{
    id: number;
    line: number;
    type: string;
    typeAr: string;
    snippet: string;
  }>>([]);
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    if (initialText && !hasRun) {
      setText(initialText);
    }
  }, [initialText, hasRun]);

  const runAnalysis = () => {
    if (!text.trim()) return;

    const lines = text.split('\n');
    const foundIssues: typeof issues = [];
    let issueId = 1;

    const passiveIndicators = ['was', 'were', 'been', 'تم', 'كان'];

    lines.forEach((line, index) => {
      const words = line.trim().split(/\s+/);
      const sentences = line.split(/[.!?]+/).filter(s => s.trim().length > 0);

      // Sentence > 40 words
      sentences.forEach(sentence => {
        const sentenceWords = sentence.trim().split(/\s+/);
        if (sentenceWords.length > 40) {
          foundIssues.push({
            id: issueId++,
            line: index + 1,
            type: "Long sentence (>40 words)",
            typeAr: "جملة طويلة (>40 كلمة)",
            snippet: sentenceWords.slice(0, 5).join(' ') + '...' + sentenceWords.slice(-5).join(' ')
          });
        }
      });

      // Passive voice
      passiveIndicators.forEach(indicator => {
        if (line.toLowerCase().includes(` ${indicator} `)) {
          foundIssues.push({
            id: issueId++,
            line: index + 1,
            type: "Passive voice indicator",
            typeAr: "مؤشر مبني للمجهول",
            snippet: `... ${indicator} ...`
          });
        }
      });

      // Missing punctuation at end of line (if line doesn't end with punctuation and next line isn't empty)
      if (line.trim().length > 0 && !/[.!?:]$/.test(line.trim())) {
         if (index < lines.length - 1 && lines[index+1].trim().length > 0) {
            // this is a naive check for demonstration
            if (foundIssues.filter(i => i.line === index + 1 && i.type === "Missing punctuation").length === 0) {
                foundIssues.push({
                    id: issueId++,
                    line: index + 1,
                    type: "Missing punctuation",
                    typeAr: "علامة ترقيم مفقودة",
                    snippet: line.trim().slice(-20)
                });
            }
         }
      }
    });

    setIssues(foundIssues);
    setHasRun(true);
  };

  const copyText = () => {
    navigator.clipboard.writeText(text);
    toast({ title: "Text copied to clipboard" });
  };

  const getScore = () => {
    if (issues.length === 0) return { label: "Excellent / ممتاز", color: "bg-success text-success-foreground" };
    if (issues.length < 5) return { label: "Good / جيد", color: "bg-primary text-primary-foreground" };
    return { label: "Needs Improvement / يحتاج تحسين", color: "bg-warning text-warning-foreground" };
  };

  return (
    <div className="space-y-6">
      <Textarea 
        className="min-h-[300px] resize-y font-sans text-sm p-4 leading-relaxed bg-card border-border text-foreground"
        placeholder={t('proofread_placeholder')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        data-testid="textarea-proofread"
      />

      <div className="flex gap-4">
        <Button onClick={runAnalysis} className="flex-1" data-testid="btn-run-proofread">
          <FileCheck2 className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
          {t('proofread_run')}
        </Button>
        <Button variant="outline" onClick={copyText} data-testid="btn-copy-proofread">
          <Copy className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
          {t('proofread_copy')}
        </Button>
      </div>

      {hasRun && (
        <Card className="border-border bg-secondary/10">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-primary" />
                Analysis Results / نتائج التحليل
              </h3>
              <Badge className={`${getScore().color} px-3 py-1 text-sm font-medium`}>
                {getScore().label}
              </Badge>
            </div>

            {issues.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <CheckCircle2 className="w-6 h-6 text-success" />
                <span>No issues found! / لم يتم العثور على أخطاء!</span>
              </div>
            ) : (
              <div className="space-y-3">
                {issues.map(issue => (
                  <div key={issue.id} className="p-3 bg-card border border-border/50 rounded-lg flex items-start gap-4">
                    <div className="bg-secondary px-2 py-1 rounded text-xs font-mono text-muted-foreground shrink-0 mt-0.5">
                      L{issue.line}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-warning mb-1">
                        {lang === 'ar' ? issue.typeAr : issue.type}
                        <span className="text-muted-foreground text-xs ml-2 rtl:mr-2 rtl:ml-0 font-normal">
                          ({lang === 'ar' ? issue.type : issue.typeAr})
                        </span>
                      </p>
                      <p className="text-sm bg-background px-2 py-1 rounded font-mono text-muted-foreground truncate">
                        "{issue.snippet}"
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}