import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { User, LogOut, FileText, Heart, MessageSquare, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/Supabase/client';
import { getMyItems, getMyFavorites, getMyMessages, updateItemStatus, type Item } from '@/services/api';
import { toast } from 'sonner';
…    </div>
  );
}
