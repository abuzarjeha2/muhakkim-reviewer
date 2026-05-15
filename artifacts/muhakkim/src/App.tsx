import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "./lib/i18n";
import Muhakkim from "./pages/Muhakkim";

function App() {
  return (
    <LanguageProvider>
      <TooltipProvider>
        <Muhakkim />
        <Toaster />
      </TooltipProvider>
    </LanguageProvider>
  );
}

export default App;
