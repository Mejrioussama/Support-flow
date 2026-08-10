-- Single-row counter used to generate unique ticket references (SF-0001, SF-0002, ...)
-- under a row-level lock, replacing the previous unlocked SELECT MAX(...) approach that
-- could produce duplicate references under concurrent ticket creation.
CREATE TABLE IF NOT EXISTS ticket_reference_sequence (
    id BIGINT NOT NULL,
    last_value INT NOT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB;

INSERT INTO ticket_reference_sequence (id, last_value)
SELECT 1, COALESCE(MAX(CAST(SUBSTRING(reference, 4) AS UNSIGNED)), 0)
FROM tickets
WHERE NOT EXISTS (SELECT 1 FROM ticket_reference_sequence WHERE id = 1);
