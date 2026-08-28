import React from 'react';
import { Search } from 'lucide-react';
import { Input } from './Input';

type SearchInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const SearchInput: React.FC<SearchInputProps> = (props) => (
  <Input type="text" leftIcon={<Search className="h-4 w-4" />} {...props} />
);
