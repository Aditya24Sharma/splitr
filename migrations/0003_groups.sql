-- Named sets of people, e.g. a trip, picked in one tap when starting a split
CREATE TABLE "PersonGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PersonGroupMember" (
    "groupId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,

    PRIMARY KEY ("groupId", "personId"),
    CONSTRAINT "PersonGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PersonGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PersonGroupMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
