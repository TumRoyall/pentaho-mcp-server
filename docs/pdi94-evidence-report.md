# PDI 9.4 Catalog Evidence Report

Target PDI version (catalog `pdi_version`): **9.4**. This report records the
target-version evidence behind every catalog row after correcting the catalog
target from PDI 11 to PDI 9.4. Evidence is never invented: a row lists `9.4` in
`verified_versions` only when an existing repository source reference or a
Spoon-saved artifact in `src/knowledge/pentaho/{job,trans}/*.md` explicitly names
PDI 9.4.

## Counts

- Total catalog rows: **88**
- Rows with explicit PDI 9.4 target evidence: **87**
- Rows without PDI 9.4 evidence (downgraded/kept observed): **1**
- `status: canonical`: **87**
- `status: observed`: **1**
- Generator-eligible (canonical + eligible + 9.4 verified): **87**

### Verification breakdown (rows with 9.4 evidence)

- `source_reviewed` (PDI 9.4 `getXML()` source reference): **79**
- `spoon_loaded` (Spoon PDI 9.4-saved artifact): **8**

### Rows kept observed (no target evidence, not promoted)

- trans / SetSessionVariableStep: No PDI 9.4 evidence located (not_established)

## Per-row evidence

| kind | xml_type | source_version | verified_versions | resulting_status | evidence |
|---|---|---|---|---|---|
| job | SPECIAL | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/START.md) |
| job | SUCCESS | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/SUCCESS.md) |
| job | SPECIAL | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/FAILURE.md) |
| job | TRANS | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/TRANS.md) |
| job | JOB | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/JOB.md) |
| job | SQL | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/SQL.md) |
| job | EVAL_TABLE_CONTENT | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/EVAL_TABLE_CONTENT.md) |
| job | MAIL | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/MAIL.md) |
| job | SET_VARIABLES | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/SET_VARIABLES.md) |
| job | SIMPLE_EVAL | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/SIMPLE_EVAL.md) |
| job | WRITE_TO_LOG | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/WRITE_TO_LOG.md) |
| job | SFTPPUT | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/SFTPPUT.md) |
| job | TRUNCATE_TABLES | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/TRUNCATE_TABLES.md) |
| job | ABORT | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/ABORT.md) |
| job | SFTP | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/SFTP.md) |
| job | COPY_FILES | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/COPY_FILES.md) |
| job | SHELL | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/SHELL.md) |
| job | DELETE_FILE | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/DELETE_FILE.md) |
| job | MOVE_FILES | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/MOVE_FILES.md) |
| job | FILE_EXISTS | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/FILE_EXISTS.md) |
| job | WAIT_FOR_FILE | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/WAIT_FOR_FILE.md) |
| job | CREATE_FOLDER | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/CREATE_FOLDER.md) |
| job | ZIP_FILE | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/ZIP_FILE.md) |
| job | UNZIP | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/UNZIP.md) |
| job | FTP | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/FTP.md) |
| job | CHECK_FILES_LOCKED | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/CHECK_FILES_LOCKED.md) |
| job | EVAL_FILES_METRICS | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/EVAL_FILES_METRICS.md) |
| job | CHECK_DB_CONNECTIONS | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/CHECK_DB_CONNECTIONS.md) |
| job | FILES_EXIST | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/FILES_EXIST.md) |
| job | DELETE_FOLDERS | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/DELETE_FOLDERS.md) |
| job | DELETE_FILES | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/DELETE_FILES.md) |
| job | DELAY | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/DELAY.md) |
| job | XSLT | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/XSLT.md) |
| job | EXPORT_REPOSITORY | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see job/EXPORT_REPOSITORY.md) |
| trans | TableInput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/TableInput.md) |
| trans | TableOutput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/TableOutput.md) |
| trans | Dummy | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/Dummy.md) |
| trans | Abort | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/Abort.md) |
| trans | SelectValues | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/SelectValues.md) |
| trans | SetVariable | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/SetVariable.md) |
| trans | GetVariable | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/GetVariable.md) |
| trans | FilterRows | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/FilterRows.md) |
| trans | ScriptValueMod | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/ScriptValueMod.md) |
| trans | GroupBy | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/GroupBy.md) |
| trans | JsonInput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/JsonInput.md) |
| trans | Rest | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/Rest.md) |
| trans | TextFileOutput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/TextFileOutput.md) |
| trans | ExcelOutput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/ExcelOutput.md) |
| trans | RowGenerator | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/RowGenerator.md) |
| trans | ExcelInput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/ExcelInput.md) |
| trans | ExecSQL | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/ExecSQL.md) |
| trans | ConcatFields | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/ConcatFields.md) |
| trans | SystemInfo | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/SystemInfo.md) |
| trans | JoinRows | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/JoinRows.md) |
| trans | WriteToLog | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/WriteToLog.md) |
| trans | RowsToResult | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/RowsToResult.md) |
| trans | InsertUpdate | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/InsertUpdate.md) |
| trans | Update | 9.4 | 9.4 | canonical | Spoon PDI 9.4-saved artifact (see trans/Update.md) |
| trans | Delete | 9.4 | 9.4 | canonical | Spoon PDI 9.4-saved artifact (see trans/Delete.md) |
| trans | DBLookup | 9.4 | 9.4 | canonical | Spoon PDI 9.4-saved artifact (see trans/DBLookup.md) |
| trans | StreamLookup | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/StreamLookup.md) |
| trans | MergeJoin | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/MergeJoin.md) |
| trans | MergeRows | 9.4 | 9.4 | canonical | Spoon PDI 9.4-saved artifact (see trans/MergeRows.md) |
| trans | Calculator | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/Calculator.md) |
| trans | SortRows | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/SortRows.md) |
| trans | Unique | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/Unique.md) |
| trans | Constant | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/Constant.md) |
| trans | ValueMapper | 9.4 | 9.4 | canonical | Spoon PDI 9.4-saved artifact (see trans/ValueMapper.md) |
| trans | StringOperations | 9.4 | 9.4 | canonical | Spoon PDI 9.4-saved artifact (see trans/StringOperations.md) |
| trans | NullIf | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/NullIf.md) |
| trans | SwitchCase | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/SwitchCase.md) |
| trans | Mapping | 9.4 | 9.4 | canonical | Spoon PDI 9.4-saved artifact (see trans/Mapping.md) |
| trans | TextFileInput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/TextFileInput.md) |
| trans | GetFileNames | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/GetFileNames.md) |
| trans | RegexEval | 9.4 | 9.4 | canonical | Spoon PDI 9.4-saved artifact (see trans/RegexEval.md) |
| trans | BlockUntilStepsFinish | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/BlockUntilStepsFinish.md) |
| trans | CsvInput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/CsvInput.md) |
| trans | PropertyInput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/PropertyInput.md) |
| trans | StringCut | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/StringCut.md) |
| trans | RandomValue | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/RandomValue.md) |
| trans | ProcessFiles | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/ProcessFiles.md) |
| trans | DataGrid | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/DataGrid.md) |
| trans | JobExecutor | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/JobExecutor.md) |
| trans | XMLOutput | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/XMLOutput.md) |
| trans | OraBulkLoader | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/OraBulkLoader.md) |
| trans | SetSessionVariableStep | not_established | (none) | observed | No PDI 9.4 evidence located (not_established) |
| trans | TypeExitExcelWriterStep | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/TypeExitExcelWriterStep.md) |
| trans | Sequence | 9.4 | 9.4 | canonical | pentaho-kettle source 9.4 getXML() reference (see trans/Sequence.md) |
