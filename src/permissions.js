// Account IDs come from the verified Supabase session, never a submitted login.
export const WRITER_ID='98f3a667-bca0-4bb6-9f2b-da011ee69ceb';
export const REVIEWER_ID='5932f3b8-6300-4a29-a7a8-ce002e8ddf31';
export const canWrite=user=>user?.id===WRITER_ID;
export const canReview=(user,record)=>!!record?.disposal&&!record.deletedAt&&(canWrite(user)||(user?.id===REVIEWER_ID&&record.createdBy!==user.id));
