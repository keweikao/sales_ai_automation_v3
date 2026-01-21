/**
 * 根據 Product Config 動態生成表單欄位
 */

import {
  getProductConfig,
  type ProductLine,
} from "@Sales_ai_automation_v3/shared/product-configs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProductConfigFormFieldsProps {
  productLine: ProductLine;
  values: {
    storeType?: string;
    serviceType?: string;
    staffCount?: string;
    currentSystem?: string;
  };
  onChange: (field: string, value: string) => void;
}

export function ProductConfigFormFields({
  productLine,
  values,
  onChange,
}: ProductConfigFormFieldsProps) {
  const config = getProductConfig(productLine);

  return (
    <div className="space-y-4">
      {/* Store Type (所有產品線都有) */}
      <div className="space-y-2">
        <Label htmlFor="storeType">
          {config.formFields.storeType.label}
          {config.formFields.storeType.required && (
            <span className="ml-1 text-red-500">*</span>
          )}
        </Label>
        <Select
          onValueChange={(value) => onChange("storeType", value)}
          value={values.storeType}
        >
          <SelectTrigger id="storeType">
            <SelectValue
              placeholder={`選擇${config.formFields.storeType.label}`}
            />
          </SelectTrigger>
          <SelectContent>
            {config.formFields.storeType.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.emoji ? `${opt.emoji} ${opt.label}` : opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Service Type (iCHEF only) */}
      {productLine === "ichef" && config.formFields.serviceType && (
        <div className="space-y-2">
          <Label htmlFor="serviceType">
            {config.formFields.serviceType.label}
            {config.formFields.serviceType.required && (
              <span className="ml-1 text-red-500">*</span>
            )}
          </Label>
          <Select
            onValueChange={(value) => onChange("serviceType", value)}
            value={values.serviceType}
          >
            <SelectTrigger id="serviceType">
              <SelectValue
                placeholder={`選擇${config.formFields.serviceType.label}`}
              />
            </SelectTrigger>
            <SelectContent>
              {config.formFields.serviceType.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.emoji ? `${opt.emoji} ${opt.label}` : opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Staff Count (Beauty only) */}
      {productLine === "beauty" && config.formFields.staffCount && (
        <div className="space-y-2">
          <Label htmlFor="staffCount">
            {config.formFields.staffCount.label}
            {config.formFields.staffCount.required && (
              <span className="ml-1 text-red-500">*</span>
            )}
          </Label>
          <Select
            onValueChange={(value) => onChange("staffCount", value)}
            value={values.staffCount}
          >
            <SelectTrigger id="staffCount">
              <SelectValue
                placeholder={`選擇${config.formFields.staffCount.label}`}
              />
            </SelectTrigger>
            <SelectContent>
              {config.formFields.staffCount.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.emoji ? `${opt.emoji} ${opt.label}` : opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Current System (所有產品線都有) */}
      <div className="space-y-2">
        <Label htmlFor="currentSystem">
          {config.formFields.currentSystem.label}
          {config.formFields.currentSystem.required && (
            <span className="ml-1 text-red-500">*</span>
          )}
        </Label>
        <Select
          onValueChange={(value) => onChange("currentSystem", value)}
          value={values.currentSystem}
        >
          <SelectTrigger id="currentSystem">
            <SelectValue
              placeholder={`選擇${config.formFields.currentSystem.label}`}
            />
          </SelectTrigger>
          <SelectContent>
            {config.formFields.currentSystem.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.emoji ? `${opt.emoji} ${opt.label}` : opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
