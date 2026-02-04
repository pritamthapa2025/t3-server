SELECT 
  cc.full_name,
  cc.email,
  cc.phone,
  cc.is_primary,
  o.name as organization_name
FROM org.client_contacts cc
JOIN org.organizations o ON cc.organization_id = o.id
WHERE o.name = 'ABC Company'
AND cc.is_deleted = false;
