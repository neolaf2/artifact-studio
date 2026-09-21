# Clarification ontology — demonstration

A ClarificationRequest concerns one ProcurementProject, is addressed to a SupplierRepresentative, has a reference identifier, and contains ClarificationItems. Each item identifies the subject and a question grounded in an unresolved issue.

Mapping: ProcurementProject.name -> project; SupplierRepresentative.displayName -> recipient; ClarificationRequest.reference -> reference; ClarificationItems -> questions; subject -> item; requested clarification -> question.

Do not infer supplier wrongdoing, a rejection decision, a deadline or evidence not present in the source. This small example is an authoring reference, not an executable ontology reasoner.
