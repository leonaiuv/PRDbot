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

interface SmartSelectorProps {
  selector: SelectorData;
  onSubmit: (values: string[]) => void;
  disabled?: boolean;
}

export function SmartSelector({ selector, onSubmit, disabled }: SmartSelectorProps) {
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [textValue, setTextValue] = useState('');

  const handleSubmit = () => {
    if (selector.type === 'text') {
      onSubmit([textValue]);
    } else {
      onSubmit(selectedValues);
    }
  };

  const isValid = () => {
    if (!selector.required) return true;
    if (selector.type === 'text') return textValue.trim().length > 0;
    return selectedValues.length > 0;
  };

  return (
    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
      <p className="font-medium">{selector.question}</p>
      
      {selector.type === 'radio' && (
        <RadioGroup
          value={selectedValues[0] || ''}
          onValueChange={(value) => setSelectedValues([value])}
          disabled={disabled}
        >
          {selector.options.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <RadioGroupItem value={option.value} id={option.value} />
              <Label htmlFor={option.value} className="cursor-pointer">
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {selector.type === 'checkbox' && (
        <div className="space-y-2">
          {selector.options.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={option.value}
                checked={selectedValues.includes(option.value)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedValues([...selectedValues, option.value]);
                  } else {
                    setSelectedValues(selectedValues.filter(v => v !== option.value));
                  }
                }}
                disabled={disabled}
              />
              <Label htmlFor={option.value} className="cursor-pointer">
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      )}

      {selector.type === 'dropdown' && (
        <Select
          value={selectedValues[0] || ''}
          onValueChange={(value) => setSelectedValues([value])}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="请选择..." />
          </SelectTrigger>
          <SelectContent>
            {selector.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {selector.type === 'text' && (
        <div className="space-y-2">
          <Input
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder="请输入..."
            disabled={disabled}
          />
          {selector.options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">建议选项：</span>
              {selector.options.map((option) => (
                <Button
                  key={option.value}
                  variant="outline"
                  size="sm"
                  onClick={() => setTextValue(option.label)}
                  disabled={disabled}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={disabled || !isValid()}
          size="sm"
        >
          <Check className="mr-2 h-4 w-4" />
          确认
        </Button>
      </div>
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
    <div className="p-3 bg-primary/10 rounded-lg">
      <p className="text-sm text-muted-foreground mb-1">{selector.question}</p>
      <p className="font-medium">
        {labels.length > 1 ? labels.join('、') : labels[0] || '未选择'}
      </p>
    </div>
  );
}
