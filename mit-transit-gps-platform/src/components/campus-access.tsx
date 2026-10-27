import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useAccount, SignInDialog } from './college-shell';
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useServerFn } from '@tanstack/react-start';
import { getCampusData } from '@/lib/campus.functions';
export function useCollegeAccess(){const {data:user}=useAccount();const approval=useQuery({queryKey:['personnel',user?.id],enabled:!!user,queryFn:async()=>{const{data,error}=await supabase.rpc('is_personnel');if(error)throw error;return data;},retry:false});return {user,approval,authorized:approval.data===true};}
export function useCampusData(){const access=useCollegeAccess();const load=useServerFn(getCampusData);const query=useQuery({queryKey:['campus',access.user?.id],enabled:access.authorized,queryFn:()=>load(),retry:false});return {...access,query};}
export function CampusAccess({children,access}:{children:React.ReactNode;access:ReturnType<typeof useCollegeAccess>}){const[open,setOpen]=useState(false);if(access.authorized)return children;return <section className="campus-empty"><h2>{!access.user?'Sign in to your college account':access.approval.isPending?'Checking college access':access.approval.error?'Access check unavailable':'College approval required'}</h2><p>{!access.user?'Use your approved Google account or phone number.':'Only college-approved accounts can view transport information.'}</p>{!access.user?<Button onClick={()=>setOpen(true)}>Sign in</Button>:access.approval.error?<Button variant="outline" onClick={()=>access.approval.refetch()}>Try again</Button>:null}<SignInDialog open={open} onOpenChange={setOpen}/></section>;}
export function CampusQueryState({query}:{query:ReturnType<typeof useCampusData>['query']}){return <section className="campus-empty"><h2>{query.isPending?'Loading college information': 'Information unavailable'}</h2>{query.error&&<><p role="alert">{query.error.message}</p><Button variant="outline" onClick={()=>query.refetch()}>Try again</Button></>}</section>;}
