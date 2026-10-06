-- Reference data: the CPCB polymer list and trade-name synonyms the classifier seeds Qdrant from.
-- Safe to re-run; existing rows are left alone.

INSERT INTO public.materials_master VALUES
	('PET', 'Polyethylene Terephthalate', 'RIGID_PLASTIC', 'Used for water bottles, food containers'),
	('HDPE', 'High Density Polyethylene', 'RIGID_PLASTIC', 'Used for pipes, milk jugs, durable containers'),
	('LDPE', 'Low Density Polyethylene', 'FLEXIBLE_PLASTIC', 'Used for plastic bags, films, wraps'),
	('PP', 'Polypropylene', 'RIGID_PLASTIC', 'Used for bottle caps, containers, automotive parts'),
	('PVC', 'Polyvinyl Chloride', 'RIGID_PLASTIC', 'Used for pipes, window frames, wire insulation'),
	('PS', 'Polystyrene', 'RIGID_PLASTIC', 'Used for foam packaging, disposable cutlery'),
	('MLP', 'Multi-layer Plastic', 'COMPOSITE', 'Used for chip packets, sachets, multi-material packaging') ON CONFLICT DO NOTHING;
INSERT INTO public.material_synonyms VALUES
	('9655c7a0-0dc8-474e-b719-9fd9ebc13cb1', 'PET', 'POLYPET 3020', 'Reliance Industries', 'Bottle Grade', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('8272f3f4-c254-4f54-abc9-7a92e28ea189', 'PET', 'PET 3020', 'Reliance Industries', 'Bottle Grade', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('bd7ce7da-bd39-493c-a1f1-6f5014e3a9bb', 'PET', 'Bottle Grade PET', 'Generic', 'For water bottles', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('0a185491-c4cc-4ecd-9717-0bf558ad9ba3', 'PET', 'PET Resin', 'Various', 'Standard PET', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('36be8ac9-2207-4d4b-8da3-c0fdec1c0bf3', 'PET', 'Polyester Chips', 'Various', 'PET alternative name', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('d8edf801-f514-4643-8993-e0fe28ffb203', 'HDPE', 'HD5400G', 'Supreme Petrochem', 'Injection Molding', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('2551cb5c-d148-4306-8689-dd03ff10398f', 'HDPE', 'HDPE 5400', 'Supreme Petrochem', 'Injection Molding', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('aeac21db-af87-4825-ac8c-c4d41becf21b', 'HDPE', 'Milk Bottle Grade', 'Various', 'HDPE for dairy', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('8039cbb7-47d4-4945-a83f-3a87a8b05584', 'HDPE', 'HDPE Pipe Grade', 'Various', 'For plumbing pipes', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('c7fa950e-76fb-4ea4-951b-34f528df24a6', 'HDPE', 'High Density PE', 'Generic', 'Standard HDPE', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('37054685-d33b-428a-bb27-9cfbc39c2615', 'LDPE', 'LD 2426K', 'Reliance Industries', 'Film Grade', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('6c8c666e-b810-42bf-a73d-6ca2d9d8316d', 'LDPE', 'LDPE Film', 'Various', 'For plastic bags', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('3245d5ad-262c-4123-8b11-3de81b15e7b6', 'LDPE', 'Low Density PE', 'Generic', 'Standard LDPE', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('4ddb0178-fb07-4373-b00b-ecdce4a88e0a', 'PP', 'REPOL 110MA', 'Reliance Industries', 'Injection Molding', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('33831466-bc35-462a-bf38-7ca401b9f57c', 'PP', 'PP 110MA', 'Reliance Industries', 'Injection Molding', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('bd6bec29-a916-4911-bb0a-be1940821a3d', 'PP', 'Polypropylene Homopolymer', 'Generic', 'Standard PP', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('af618b6e-71a5-4a4a-956b-4661e48af91a', 'PP', 'PP Copolymer', 'Various', 'Impact resistant', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('e7326506-6f7a-4007-9667-816d3faccdfa', 'MLP', 'Lamica 12 micron', 'Flex Films', 'Flexible Packaging', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('adfbab09-b66a-474d-be44-7dad4f8d3316', 'MLP', '12 micron film', 'Flex Films', 'Multilayer laminate', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('cd50f9b5-172b-4148-9445-ac7ac4d18ce2', 'MLP', 'Metallized Film', 'Various', 'MLP with metal layer', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('c3c8ee6b-6948-4187-86c3-15f5d59f28fd', 'MLP', 'Chip Packet Material', 'Generic', 'Multilayer packaging', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('a286f354-677b-40de-89c4-52778ea2e25c', 'MLP', 'Sachet Material', 'Generic', 'Small packet multilayer', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('4d4ab171-4890-468a-a923-6ad918eada3b', 'PVC', 'PVC Resin', 'Various', 'Standard PVC', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('b0ce197f-eda7-4581-ba97-8f79640719e0', 'PVC', 'PVC Pipe Grade', 'Various', 'For construction', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('eb651e76-113a-403d-9362-b0c23a368b66', 'PS', 'GPPS', 'Various', 'General Purpose Polystyrene', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00'),
	('71cfac0a-4bc6-4f0e-8b09-a21012b51704', 'PS', 'HIPS', 'Various', 'High Impact Polystyrene', 'plastic_synonyms', '2026-02-24 08:14:20.259475+00') ON CONFLICT DO NOTHING;
