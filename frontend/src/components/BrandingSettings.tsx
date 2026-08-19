import { useState, ChangeEvent, useEffect } from "react";
import { Upload, Check, Loader2, Palette, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useTenant, useUpdateBranding } from "@/hooks/queries";

const PRESETS = [
  "#2563eb", "#4f46e5", "#7c3aed", "#db2777",
  "#dc2626", "#f97316", "#059669", "#0891b2",
];

export function BrandingSettings() {
  const { data: tenant } = useTenant();
  const update = useUpdateBranding();

  const [logo, setLogo] = useState<string | null>(null);
  const [color, setColor] = useState<string>("#2563eb");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (tenant && !initialized) {
      setLogo(tenant.logo_data_url || null);
      setColor(tenant.brand_color || "#2563eb");
      setInitialized(true);
    }
  }, [tenant, initialized]);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 300_000) {
      toast.error("Logo too large — please pick an image under 300 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setLogo(result);
    };
    reader.readAsDataURL(f);
  };

  const save = async () => {
    try {
      await update.mutateAsync({ logo_data_url: logo, brand_color: color });
      toast.success("Branding updated");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Failed to update branding");
    }
  };

  const clearLogo = () => setLogo(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Logo */}
      <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Tenant logo
          </h3>
        </div>

        <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950/40">
          {logo ? (
            <img
              data-testid="branding-logo-preview"
              src={logo}
              alt="Tenant logo preview"
              className="max-h-24 max-w-full object-contain"
            />
          ) : (
            <div className="text-center text-slate-500 dark:text-slate-400 text-xs py-4">
              PNG or SVG, under 300 KB
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <label
            data-testid="branding-upload-label"
            className="flex-1 cursor-pointer bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-medium py-2 rounded-lg text-xs flex items-center justify-center gap-2"
          >
            <Upload className="w-3.5 h-3.5" />
            {logo ? "Replace" : "Upload logo"}
            <input
              data-testid="branding-logo-input"
              type="file"
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
              className="hidden"
              onChange={onFile}
            />
          </label>
          {logo && (
            <button
              data-testid="branding-clear"
              onClick={clearLogo}
              className="px-3 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Color */}
      <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Brand color
          </h3>
        </div>

        <div className="grid grid-cols-8 gap-2 mb-4">
          {PRESETS.map((c) => (
            <button
              key={c}
              data-testid={`branding-preset-${c.replace("#", "")}`}
              onClick={() => setColor(c)}
              className={`aspect-square rounded-lg border-2 transition-all ${
                color === c
                  ? "border-slate-900 dark:border-white scale-110"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Set brand color ${c}`}
            >
              {color === c && <Check className="w-4 h-4 text-white mx-auto" />}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input
            data-testid="branding-color-picker"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer border border-slate-300 dark:border-slate-700"
          />
          <input
            data-testid="branding-color-hex"
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="font-mono text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 w-32 focus:outline-none focus:border-blue-500"
          />
          <div
            className="w-16 h-10 rounded-lg border border-slate-300 dark:border-slate-700"
            style={{ backgroundColor: color }}
          />
        </div>

        <p className="text-[11px] text-slate-500 mt-4">
          Applied to sidebar accents, active states and the brand logo tile.
        </p>
      </div>

      {/* Save */}
      <div className="md:col-span-2 flex items-center justify-end gap-3">
        <button
          data-testid="branding-save"
          onClick={save}
          disabled={update.isPending}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-lg shadow-blue-600/20"
        >
          {update.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Save branding
        </button>
      </div>
    </div>
  );
}
