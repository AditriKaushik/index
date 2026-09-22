# The JavaScript bridge is reached by name from the page, so it must survive
# any future shrinking of the release build.
-keepclassmembers class org.mahendras.guardian.MainActivity$GuardianHost {
    public *;
}
-keepattributes JavascriptInterface
