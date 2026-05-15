import React, { useState } from 'react';
import { useLanguage } from "../../lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { FunctionSquare, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EquationResult {
  id: number;
  line: number;
  equation: string;
  status: 'valid' | 'warning' | 'error';
  message?: string;
}

export default function EquationChecker() {
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const [results, setResults] = useState<EquationResult[]>([]);
  const [hasRun, setHasRun] = useState(false);

  const runAnalysis = () => {
    if (!text.trim()) return;

    const lines = text.split('\n');
    const parsed: EquationResult[] = [];
    let id = 1;

    const eqPatterns = ['=', '\\frac', '\\sum', '\\int', '∑', '∫', '√', '^', '_'];

    lines.forEach((line, index) => {
      if (eqPatterns.some(p => line.includes(p)) && line.trim().length > 3) {
        
        let status: EquationResult['status'] = 'valid';
        let message = '';

        // Basic validation
        const leftParens = (line.match(/\(/g) || []).length;
        const rightParens = (line.match(/\)/g) || []).length;
        const leftBrackets = (line.match(/\[/g) || []).length;
        const rightBrackets = (line.match(/\]/g) || []).length;
        const leftBraces = (line.match(/\{/g) || []).length;
        const rightBraces = (line.match(/\}/g) || []).length;

        if (leftParens !== rightParens || leftBrackets !== rightBrackets || leftBraces !== rightBraces) {
            status = 'error';
            message = 'Unbalanced parentheses or brackets';
        } else if (line.match(/\+\+|--|\*\*|\/\//)) {
            status = 'warning';
            message = 'Possible double operator';
        } else if (line.includes('\\left') && !line.includes('\\right')) {
            status = 'error';
            message = 'Missing \right for \left';
        }

        parsed.push({
          id: id++,
          line: index + 1,
          equation: line.trim(),
          status,
          message
        });
      }
    });

    setResults(parsed);
    setHasRun(true);
  };

  return (
    <div className="space-y-6">
      <Textarea 
        className="min-h-[200px] resize-y font-mono text-sm p-4 bg-card border-border text-foreground"
        placeholder={t('eq_placeholder')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        data-testid="textarea-eq"
      />

      <div className="flex gap-4">
        <Button onClick={runAnalysis} className="flex-1" data-testid="btn-run-eq">
          <FunctionSquare className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
          {t('eq_run')}
        </Button>
      </div>

      {hasRun && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mb-4 px-2">Detected Equations / المعادلات المكتشفة</h3>
          {results.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No equations found.</p>
          ) : (
            results.map(res => (
              <Card key={res.id} className={`border-l-4 ${res.status === 'error' ? 'border-l-destructive' : res.status === 'warning' ? 'border-l-warning' : 'border-l-success'}`}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">Line {res.line}</span>
                      {res.status === 'valid' ? (
                         <Badge variant="outline" className="text-success border-success bg-success/10">Valid</Badge>
                      ) : res.status === 'warning' ? (
                         <Badge variant="outline" className="text-warning border-warning bg-warning/10">Warning</Badge>
                      ) : (
                         <Badge variant="outline" className="text-destructive border-destructive bg-destructive/10">Error</Badge>
                      )}
                    </div>
                    <div className="bg-background border border-border rounded p-3 overflow-x-auto">
                       <code className="text-sm font-mono text-primary whitespace-pre">{res.equation}</code>
                    </div>
                    {res.message && (
                        <p className={`text-sm mt-2 flex items-center gap-1 ${res.status === 'error' ? 'text-destructive' : 'text-warning'}`}>
                            <AlertTriangle className="w-4 h-4" /> {res.message}
                        </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}