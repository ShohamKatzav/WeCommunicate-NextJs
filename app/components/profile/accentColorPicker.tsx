import { ACCENT_COLORS } from "../../config/limits";
import { useT } from "../../i18n/client";

interface AccentColorPickerProps {
    value?: string;
    onChange: (color: string) => void;
}

const AccentColorPicker = ({ value, onChange }: AccentColorPickerProps) => {
    const t = useT();
    return (
        <div className="flex flex-wrap gap-2 sm:gap-3" role="radiogroup" aria-label={t("profile.edit.accentColor")}>
            {ACCENT_COLORS.map(color => (
                <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={value === color}
                    aria-label={t("profile.edit.accentColorOption", { color })}
                    onClick={() => onChange(color)}
                    className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-105 sm:h-8 sm:w-8 ${value === color ? "border-foreground scale-110" : "border-transparent"
                        }`}
                    style={{ backgroundColor: color }}
                />
            ))}
        </div>
    );
};

export default AccentColorPicker;
