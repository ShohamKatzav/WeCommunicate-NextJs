import { ACCENT_COLORS } from "../../config/limits";
import { useT } from "../../i18n/client";

interface AccentColorPickerProps {
    value?: string;
    onChange: (color: string) => void;
}

const AccentColorPicker = ({ value, onChange }: AccentColorPickerProps) => {
    const t = useT();
    return (
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={t("profile.edit.accentColor")}>
            {ACCENT_COLORS.map(color => (
                <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={value === color}
                    aria-label={t("profile.edit.accentColorOption", { color })}
                    onClick={() => onChange(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-105 ${value === color ? "border-foreground scale-110" : "border-transparent"
                        }`}
                    style={{ backgroundColor: color }}
                />
            ))}
        </div>
    );
};

export default AccentColorPicker;
