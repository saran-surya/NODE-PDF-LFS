# NODE-PDF-LFS
### Who is this package going help ?
-  To all the people who generat large amounts of HTML reports for any sort of execution / Process and want to convert them to PDF's due to requirements.
-  This can help you generate PDF's from your existing HTML REPORTS, I did bench-marks with 25000 pages of PDF conversion : Say a 400 MB HTML to PDF took about ~45 Mins
-  Yes < 5000 pages, you have it in less than ~5 mins, More the pages more the time. But let's assume your max cap is going to be 1 hr MAX

### What issue does this solve ?
-  Chrome is our goto tool to generate PDF's atleast from HTML's, But when our size of HTML gets larger we end up facing issues
-  So here we follow a ***DIVIDE AND CONQUER*** method to get things done.

### What's Special ?
-  Define what contents you expect in a A4-Size page of your report and split them with the tags
   ```html
   <page></page>                       <!-- This defines your page split -->
   <globalsettings></globalsettings>   <!-- Defines what should be repeated in each page / HTML buffer -->
   ```
-  Supports CSS3, No matter how heavy your CSS is, The package handles it for you (Maybe try adjusting the variable ```--min-page-buffer``` if it's too heavy

## Let's Get Started
## Installation
### NOTE
```
Always perform this in a empty directory. 
This is a standalone package, Not a dependancy (Atleast for now)
```

```cmd
npm i node-pdf-lfs
```

## PARAMETERS YOU CAN CONTROL

| CMD PARAMETER  |  VALUE IN SCRIPT | DETAIL |
| ----------------------- | ----------------------- | ----------------------- |
| --template-file | TEMPLATE_FILE | File to be treated for indexing with ```<page></page>``` and ```<globalsettings></globalsettings>```  |
| --result-root | RESULT_ROOT | Location of storing the final PDF after completing the MERGE : default name -> temp-1.pdf  |
| --asset-root | ASSET_ROOT | Location where the TEMPLATE HTML file should look for assets |
| --temp-root | TEMP_ROOT | Location where the temporary template html's will be stored |
| --min-page-buffer | MIN_PAGE_BUFFER | The minimum pages that are indexed using ```<page></page>``` should be included in a file |
| --verbose | DEBUG_FLAG | Displays all ```console.debug()``` logs for debugging purposes of indexing |

## Example
```node . --verbose --result-root="" --assset-root="" --temp-root="" --template-file="" --min-page-buffer=50```

