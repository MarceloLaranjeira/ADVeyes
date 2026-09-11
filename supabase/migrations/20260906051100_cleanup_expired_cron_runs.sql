begin;

delete from cron.job_run_details detail
where (detail.status = 'succeeded' and detail.end_time < now() - interval '3 days')
   or (detail.status <> 'succeeded' and detail.end_time < now() - interval '30 days');

commit;
