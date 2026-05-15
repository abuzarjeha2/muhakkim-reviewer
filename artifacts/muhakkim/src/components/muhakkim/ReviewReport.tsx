import React, { useState } from 'react';
import { useLanguage } from "../../lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Printer, FileText } from "lucide-react";

export default function ReviewReport() {
  const { t, lang, dir } = useLanguage();
  const [formData, setFormData] = useState({
    title: "",
    author: "",
    reviewer: "",
    date: new Date().toISOString().split('T')[0],
    scores: {
      originality: 3,
      methodology: 3,
      lit: 3,
      clarity: 3,
      contrib: 3
    },
    recommendation: "",
    comments: ""
  });

  const [showReport, setShowReport] = useState(false);

  const handleScoreChange = (key: keyof typeof formData.scores, value: number[]) => {
    setFormData(prev => ({
      ...prev,
      scores: { ...prev.scores, [key]: value[0] }
    }));
  };

  const getAverage = () => {
    const vals = Object.values(formData.scores);
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Form Area */}
      <div className="space-y-6 lg:border-r lg:border-border lg:pr-8 lg:rtl:pl-8 lg:rtl:pr-0 pb-12 hide-on-print">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 col-span-2">
            <Label>{t('report_title')}</Label>
            <Input 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})} 
              className="bg-card"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('report_author')}</Label>
            <Input 
              value={formData.author} 
              onChange={e => setFormData({...formData, author: e.target.value})} 
              className="bg-card"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('report_date')}</Label>
            <Input 
              type="date"
              value={formData.date} 
              onChange={e => setFormData({...formData, date: e.target.value})} 
              className="bg-card"
            />
          </div>
        </div>

        <div className="space-y-6 pt-4 border-t border-border">
          <h3 className="font-semibold text-primary">Scores (1-5)</h3>
          
          {(Object.keys(formData.scores) as Array<keyof typeof formData.scores>).map((key) => (
            <div key={key} className="space-y-3">
              <div className="flex justify-between">
                <Label>{t(`report_${key}` as any)}</Label>
                <span className="font-mono text-primary font-bold">{formData.scores[key]}/5</span>
              </div>
              <Slider 
                value={[formData.scores[key]]} 
                min={1} max={5} step={1}
                onValueChange={(val) => handleScoreChange(key, val)}
              />
            </div>
          ))}
        </div>

        <div className="space-y-2 pt-4 border-t border-border">
          <Label>{t('report_rec')}</Label>
          <Select value={formData.recommendation} onValueChange={v => setFormData({...formData, recommendation: v})}>
            <SelectTrigger className="bg-card">
              <SelectValue placeholder="Select recommendation..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Accept">Accept</SelectItem>
              <SelectItem value="Minor">Accept with Minor Revisions</SelectItem>
              <SelectItem value="Major">Major Revisions Required</SelectItem>
              <SelectItem value="Reject">Reject</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t('report_comments')}</Label>
          <Textarea 
            value={formData.comments}
            onChange={e => setFormData({...formData, comments: e.target.value})}
            className="min-h-[150px] bg-card"
          />
        </div>

        <Button onClick={() => setShowReport(true)} className="w-full">
          <FileText className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
          {t('report_generate')}
        </Button>
      </div>

      {/* Preview / Print Area */}
      <div className={`print-area ${showReport ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        <Card className="bg-white text-black print:shadow-none print:border-none">
          <CardContent className="p-8 space-y-6">
            <div className="border-b-2 border-black pb-6 mb-6">
              <h1 className="text-2xl font-bold uppercase tracking-widest text-center mb-2">Peer Review Report</h1>
              <p className="text-center text-gray-500 font-serif">Muhakkim Academic System</p>
            </div>

            <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
              <div>
                <span className="text-gray-500 block uppercase text-xs font-bold mb-1">Paper Title</span>
                <span className="font-medium text-base">{formData.title || "—"}</span>
              </div>
              <div>
                <span className="text-gray-500 block uppercase text-xs font-bold mb-1">Date</span>
                <span className="font-medium">{formData.date}</span>
              </div>
              <div>
                <span className="text-gray-500 block uppercase text-xs font-bold mb-1">Author</span>
                <span className="font-medium">{formData.author || "—"}</span>
              </div>
            </div>

            <div className="py-6 my-6 border-y border-gray-200">
              <h3 className="uppercase text-xs font-bold text-gray-500 mb-4 tracking-wider">Evaluation Scores</h3>
              <div className="space-y-3">
                {(Object.keys(formData.scores) as Array<keyof typeof formData.scores>).map((key) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="font-medium">{t(`report_${key}` as any)}</span>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(n => (
                        <div key={n} className={`w-6 h-6 flex items-center justify-center rounded-sm text-xs font-bold ${n <= formData.scores[key] ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>
                          {n}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-4 flex justify-between items-center border-t border-gray-200">
                <span className="uppercase text-xs font-bold text-gray-500">Overall Score</span>
                <span className="text-2xl font-bold">{getAverage()} <span className="text-sm text-gray-400">/ 5.0</span></span>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="uppercase text-xs font-bold text-gray-500 mb-2 tracking-wider">Recommendation</h3>
              <div className={`inline-block px-4 py-2 rounded font-bold border-2 ${
                formData.recommendation === 'Accept' ? 'border-green-600 text-green-700' :
                formData.recommendation === 'Minor' ? 'border-blue-600 text-blue-700' :
                formData.recommendation === 'Major' ? 'border-orange-500 text-orange-600' :
                formData.recommendation === 'Reject' ? 'border-red-600 text-red-700' :
                'border-gray-300 text-gray-500'
              }`}>
                {formData.recommendation || "Not Selected"}
              </div>
            </div>

            <div>
              <h3 className="uppercase text-xs font-bold text-gray-500 mb-3 tracking-wider">Comments to Author</h3>
              <div className="bg-gray-50 p-4 rounded text-sm whitespace-pre-wrap font-serif leading-relaxed min-h-[100px]">
                {formData.comments || "No comments provided."}
              </div>
            </div>

          </CardContent>
        </Card>

        {showReport && (
          <div className="mt-4 flex justify-end hide-on-print">
            <Button onClick={handlePrint} variant="outline" className="bg-white text-black hover:bg-gray-100">
              <Printer className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
              {t('report_print')}
            </Button>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .hide-on-print {
            display: none !important;
          }
        }
      `}} />
    </div>
  );
}