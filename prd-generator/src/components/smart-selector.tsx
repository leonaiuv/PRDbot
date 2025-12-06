'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SelectorData, SelectorOption } from '@/types';

// 受控模式 Props（推荐：用于多选择器统一提交场景）
interface ControlledSelectorProps {
  selector: SelectorData;
  value: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  showSubmitButton?: false; // 受控模式不显示单独提交按钮
}

// 非受控模式 Props（兼容：用于单个选择器独立提交场景）
interface UncontrolledSelectorProps {
  selector: SelectorData;
  onSubmit: (values: string[]) => void;
  disabled?: boolean;
  showSubmitButton?: true;
  value?: never;
  onChange?: never;
}

type SmartSelectorProps = ControlledSelectorProps | UncontrolledSelectorProps;

// 判断是否为受控模式
function isControlled(props: SmartSelectorProps): props is ControlledSelectorProps {
  return 'onChange' in props && props.onChange !== undefined;
}

export function SmartSelector(props: SmartSelectorProps) {
  const { selector, disabled } = props;
  
  // 内部状态（仅用于非受控模式）
  const [internalValues, setInternalValues] = useState<string[]>([]);
  const [internalTextValue, setInternalTextValue] = useState('');
  
  // 根据模式获取当前值
  const currentValues = isControlled(props) ? props.value : internalValues;
  const currentTextValue = isControlled(props) 
    ? (props.value[0] || '') 
    : internalTextValue;

  // 处理值变更
  const handleValuesChange = (values: string[]) => {
    if (isControlled(props)) {
      props.onChange(values);
    } else {
      setInternalValues(values);
    }
  };

  const handleTextChange = (text: string) => {
    if (isControlled(props)) {
      props.onChange([text]);
    } else {
      setInternalTextValue(text);
    }
  };

  // 非受控模式的提交处理
  const handleSubmit = () => {
    if (!isControlled(props) && props.onSubmit) {
      if (selector.type === 'text') {
        props.onSubmit([internalTextValue]);
      } else {
        props.onSubmit(internalValues);
      }
    }
  };

  const isValid = () => {
    if (!selector.required) return true;
    if (selector.type === 'text') return currentTextValue.trim().length > 0;
    return currentValues.length > 0;
  };
  
  // 是否显示提交按钮（非受控模式默认显示，受控模式不显示）
  const showSubmitButton = !isControlled(props);

  return (
    <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-muted/50 rounded-xl transition-all hover:bg-muted/70">
      <p className="font-medium text-sm sm:text-base">{selector.question}</p>
      
      {selector.type === 'radio' && (
        <RadioGroup
          value={currentValues[0] || ''}
          onValueChange={(value) => handleValuesChange([value])}
          disabled={disabled}
          className="space-y-2"
        >
          {selector.options.map((option) => (
            <div key={option.value} className="flex items-center space-x-2.5 sm:space-x-3">
              <RadioGroupItem 
                value={option.value} 
                id={`${selector.id}-${option.value}`}
                className="h-4 w-4 sm:h-5 sm:w-5"
              />
              <Label 
                htmlFor={`${selector.id}-${option.value}`} 
                className="cursor-pointer text-sm sm:text-base flex-1 py-1"
              >
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {selector.type === 'checkbox' && (
        <div className="space-y-2">
          {selector.options.map((option) => (
            <div key={option.value} className="flex items-center space-x-2.5 sm:space-x-3">
              <Checkbox
                id={`${selector.id}-${option.value}`}
                checked={currentValues.includes(option.value)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    handleValuesChange([...currentValues, option.value]);
                  } else {
                    handleValuesChange(currentValues.filter(v => v !== option.value));
                  }
                }}
                disabled={disabled}
                className="h-4 w-4 sm:h-5 sm:w-5"
              />
              <Label 
                htmlFor={`${selector.id}-${option.value}`} 
                className="cursor-pointer text-sm sm:text-base flex-1 py-1"
              >
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      )}

      {selector.type === 'dropdown' && (
        <Select
          value={currentValues[0] || ''}
          onValueChange={(value) => handleValuesChange([value])}
          disabled={disabled}
        >
          <SelectTrigger className="h-10 sm:h-11 text-sm sm:text-base">
            <SelectValue placeholder="请选择..." />
          </SelectTrigger>
          <SelectContent>
            {selector.options.map((option) => (
              <SelectItem key={option.value} value={option.value} className="text-sm sm:text-base">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {selector.type === 'text' && (
        <div className="space-y-2 sm:space-y-3">
          <Input
            value={currentTextValue}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="请输入..."
            disabled={disabled}
            className="h-10 sm:h-11 text-sm sm:text-base"
          />
          {selector.options.length > 0 && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <span className="text-xs sm:text-sm text-muted-foreground">建议选项：</span>
              {selector.options.map((option) => (
                <Button
                  key={option.value}
                  variant="outline"
                  size="sm"
                  onClick={() => handleTextChange(option.label)}
                  disabled={disabled}
                  className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 touch-feedback"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 非受控模式显示单独提交按钮 */}
      {showSubmitButton && (
        <div className="flex justify-end pt-1">
          <Button
            onClick={handleSubmit}
            disabled={disabled || !isValid()}
            size="sm"
            className="h-8 sm:h-9 text-xs sm:text-sm touch-feedback"
          >
            <Check className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            确认
          </Button>
        </div>
      )}
      
      {/* 受控模式显示已选状态提示 */}
      {!showSubmitButton && currentValues.length > 0 && (
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
          <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
          <span>已选择</span>
        </div>
      )}
    </div>
  );
}

// 显示用户已选择的答案
interface SelectedAnswerProps {
  selector: SelectorData;
  selectedValues: string[];
}

export function SelectedAnswer({ selector, selectedValues }: SelectedAnswerProps) {
  const getLabels = () => {
    if (selector.type === 'text') {
      return selectedValues;
    }
    return selectedValues.map(value => {
      const option = selector.options.find(o => o.value === value);
      return option?.label || value;
    });
  };

  const labels = getLabels();

  return (
    <div className="p-2.5 sm:p-3 bg-primary/10 rounded-xl">
      <p className="text-xs sm:text-sm text-muted-foreground mb-1">{selector.question}</p>
      <p className="font-medium text-sm sm:text-base">
        {labels.length > 1 ? labels.join('、') : labels[0] || '未选择'}
      </p>
    </div>
  );
}
